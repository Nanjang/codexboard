import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import type { Board, Post, Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import type { Request } from 'express';
import * as path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { SessionUser } from '../../common/types/session';
import {
  buildOptionsCsv,
  hasSecretOption,
  joinNoticeList,
  parseOptionsCsv,
  randomToken,
  splitNoticeList,
  yyyymmdd
} from '../../common/utils/strings';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BoardQueryDto,
  DeleteCommentDto,
  DeleteDto,
  DownloadQueryDto,
  GoodDto,
  PasswordCheckDto,
  PasswordQueryDto,
  SearchQueryDto,
  WriteCommentUpdateDto,
  WriteQueryDto,
  WriteTokenDto,
  WriteUpdateDto
} from './dto/bbs.dto';

type BoardWithGroup = Board & {
  group: {
    id: number;
    grId: string;
    subject: string;
    adminUserId: number | null;
    useAccess: boolean;
  };
};

type SessionBag = {
  [key: string]: unknown;
};

const SUPER_LEVEL = 10;
const LIST_ROWS = 20;
const MAX_REPLY_DEPTH = 10;
const MAX_COMMENT_REPLY_DEPTH = 5;

@Injectable()
export class BbsService {
  constructor(private readonly prisma: PrismaService) {}

  async board(query: BoardQueryDto, req: Request, user?: SessionUser) {
    const board = await this.requireBoard(query.bo_table, user);
    this.ensureLevel(board.boListLevel, user, '紐⑸줉 沅뚰븳???놁뒿?덈떎.');

    if (query.wr_id) {
      return this.viewBoardPost(board, query.wr_id, req, user);
    }

    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * LIST_ROWS;

    const where: Prisma.PostWhereInput = {
      boardId: board.id,
      isComment: false
    };

    if (query.sca) {
      where.categoryName = query.sca;
    }

    const searchWhere = this.buildSearchWhere(query.sfl, query.stx, query.sop);
    if (searchWhere) {
      where.AND = [searchWhere];
    }

    const allowedSort = new Map<string, Prisma.PostOrderByWithRelationInput>([
      ['createdAt', { createdAt: 'desc' }],
      ['hit', { hit: 'desc' }],
      ['good', { good: 'desc' }],
      ['nogood', { nogood: 'desc' }],
      ['id', { id: 'desc' }]
    ]);
    const sortField = query.sst ?? board.boSortField;
    const customSort = sortField ? allowedSort.get(sortField) : undefined;
    const orderBy: Prisma.PostOrderByWithRelationInput[] = customSort
      ? [customSort]
      : [{ num: 'asc' }, { reply: 'asc' }];

    const [count, posts] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        skip,
        take: LIST_ROWS,
        select: {
          id: true,
          parentId: true,
          reply: true,
          categoryName: true,
          optionsCsv: true,
          subject: true,
          hit: true,
          good: true,
          nogood: true,
          commentNo: true,
          createdAt: true,
          userId: true,
          name: true,
          user: {
            select: {
              id: true,
              loginId: true,
              nick: true,
              level: true
            }
          }
        }
      })
    ]);

    const noticeIds = splitNoticeList(board.boNotice);
    const notices =
      noticeIds.length > 0
        ? await this.prisma.post.findMany({
            where: {
              boardId: board.id,
              id: { in: noticeIds },
              isComment: false
            },
            orderBy: [{ num: 'asc' }, { reply: 'asc' }],
            select: {
              id: true,
              subject: true,
              categoryName: true,
              createdAt: true,
              hit: true,
              good: true,
              nogood: true,
              name: true
            }
          })
        : [];

    return {
      ok: true,
      board: this.exposeBoard(board),
      page,
      rows: LIST_ROWS,
      totalCount: count,
      totalPage: Math.max(1, Math.ceil(count / LIST_ROWS)),
      notices,
      posts
    };
  }

  async writeForm(query: WriteQueryDto, req: Request, user?: SessionUser) {
    const board = await this.requireBoard(query.bo_table, user);
    const mode = query.w ?? '';

    if (mode === 'r') {
      this.ensureLevel(board.boReplyLevel, user, '?듦? 沅뚰븳???놁뒿?덈떎.');
    } else {
      this.ensureLevel(board.boWriteLevel, user, '湲?곌린 沅뚰븳???놁뒿?덈떎.');
    }

    let post: Pick<Post, 'id' | 'parentId' | 'subject' | 'content' | 'reply' | 'optionsCsv'> | null = null;
    if ((mode === 'u' || mode === 'r') && query.wr_id) {
      post = await this.prisma.post.findFirst({
        where: {
          id: query.wr_id,
          boardId: board.id,
          isComment: false
        },
        select: {
          id: true,
          parentId: true,
          subject: true,
          content: true,
          reply: true,
          optionsCsv: true
        }
      });
      if (!post) {
        throw new NotFoundException('寃뚯떆湲??李얠쓣 ???놁뒿?덈떎.');
      }
    }

    const token = this.issueToken(req, `ss_write_token_${board.boTable}`);
    return { ok: true, mode, token, board: this.exposeBoard(board), post };
  }

  async writeToken(dto: WriteTokenDto, req: Request) {
    const board = await this.requireBoard(dto.bo_table);
    const token = this.issueToken(req, `ss_write_token_${board.boTable}`);
    return { ok: true, token };
  }

  async writeUpdate(
    dto: WriteUpdateDto,
    files: Express.Multer.File[],
    req: Request,
    user?: SessionUser
  ) {
    const board = await this.requireBoard(dto.bo_table, user);
    this.verifyToken(req, `ss_write_token_${board.boTable}`, dto.token);

    const mode = dto.w ?? '';
    if (mode === 'u') {
      return this.updatePost(board, dto, files, req, user);
    }
    if (mode === 'r') {
      return this.replyPost(board, dto, files, req, user);
    }
    return this.createPost(board, dto, files, req, user);
  }

  async writeCommentUpdate(dto: WriteCommentUpdateDto, req: Request, user?: SessionUser) {
    const board = await this.requireBoard(dto.bo_table, user);
    this.verifyToken(req, `ss_write_token_${board.boTable}`, dto.token);
    this.ensureLevel(board.boCommentLevel, user, '?볤? 沅뚰븳???놁뒿?덈떎.');

    const root = await this.prisma.post.findFirst({
      where: {
        id: dto.wr_id,
        boardId: board.id,
        isComment: false
      }
    });
    if (!root) {
      throw new NotFoundException('?먭???李얠쓣 ???놁뒿?덈떎.');
    }

    if (dto.w === 'cu') {
      return this.updateComment(board, root, dto, req, user);
    }
    return this.createComment(board, root, dto, req, user);
  }

  async download(query: DownloadQueryDto, req: Request, user?: SessionUser) {
    const board = await this.requireBoard(query.bo_table, user);
    this.ensureLevel(board.boReadLevel, user, '?쎄린 沅뚰븳???놁뒿?덈떎.');
    this.ensureLevel(board.boDownloadLevel, user, '?ㅼ슫濡쒕뱶 沅뚰븳???놁뒿?덈떎.');

    const post = await this.prisma.post.findFirst({
      where: { id: query.wr_id, boardId: board.id },
      select: { id: true, parentId: true }
    });
    if (!post) {
      throw new NotFoundException('寃뚯떆湲??李얠쓣 ???놁뒿?덈떎.');
    }

    const rootId = post.parentId ?? post.id;
    const viewKey = `ss_view_${board.boTable}_${rootId}`;
    if (!this.getSession(req)[viewKey]) {
      throw new ForbiddenException('寃뚯떆湲 議고쉶 ?몄뀡???꾩슂?⑸땲??');
    }

    const file = await this.prisma.boardFile.findUnique({
      where: {
        boardId_postId_fileNo: {
          boardId: board.id,
          postId: post.id,
          fileNo: query.no
        }
      }
    });
    if (!file) {
      throw new NotFoundException('?뚯씪??李얠쓣 ???놁뒿?덈떎.');
    }

    if (user && board.boDownloadPoint !== 0) {
      const relAction = `download:${rootId}`;
      const point = await this.prisma.point.findUnique({
        where: {
          userId_relTable_relId_relAction: {
            userId: user.id,
            relTable: 'posts',
            relId: String(rootId),
            relAction
          }
        },
        select: { id: true }
      });
      if (!point) {
        const delta = board.boDownloadPoint > 0 ? -board.boDownloadPoint : board.boDownloadPoint;
        await this.grantPoint(user.id, delta, '?뚯씪 ?ㅼ슫濡쒕뱶', 'posts', String(rootId), relAction);
      }
    }

    const downloadKey = `ss_download_${board.boTable}_${post.id}_${query.no}`;
    if (!this.getSession(req)[downloadKey]) {
      await this.prisma.boardFile.update({
        where: { id: file.id },
        data: { downloadCount: { increment: 1 } }
      });
      this.getSession(req)[downloadKey] = true;
    }

    const absolutePath = this.resolveStoredFilePath(board.id, file.storedFilename);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('臾쇰━ ?뚯씪??議댁옱?섏? ?딆뒿?덈떎.');
    }

    return { absolutePath, originalFilename: file.originalFilename };
  }

  async good(dto: GoodDto, _req: Request, user?: SessionUser) {
    if (!user) {
      throw new UnauthorizedException('濡쒓렇?몄씠 ?꾩슂?⑸땲??');
    }

    const board = await this.requireBoard(dto.bo_table, user);
    const post = await this.prisma.post.findFirst({
      where: { id: dto.wr_id, boardId: board.id, isComment: false },
      select: { id: true, userId: true }
    });
    if (!post) {
      throw new NotFoundException('寃뚯떆湲??李얠쓣 ???놁뒿?덈떎.');
    }

    if (post.userId === user.id) {
      throw new ForbiddenException('蹂몄씤 湲? 異붿쿇/鍮꾩텛泥쒗븷 ???놁뒿?덈떎.');
    }
    if (dto.good === 'good' && !board.boUseGood) {
      throw new ForbiddenException('異붿쿇 湲곕뒫??鍮꾪솢?깊솕?섏뼱 ?덉뒿?덈떎.');
    }
    if (dto.good === 'nogood' && !board.boUseNogood) {
      throw new ForbiddenException('鍮꾩텛泥?湲곕뒫??鍮꾪솢?깊솕?섏뼱 ?덉뒿?덈떎.');
    }

    try {
      await this.prisma.boardGood.create({
        data: {
          boardId: board.id,
          postId: post.id,
          userId: user.id,
          flag: dto.good === 'good' ? 'GOOD' : 'NOGOOD'
        }
      });
    } catch {
      throw new BadRequestException('?대? 泥섎━??異붿쿇/鍮꾩텛泥쒖엯?덈떎.');
    }

    const updated = await this.prisma.post.update({
      where: { id: post.id },
      data: dto.good === 'good' ? { good: { increment: 1 } } : { nogood: { increment: 1 } },
      select: { good: true, nogood: true }
    });
    return { ok: true, ...updated };
  }

  async delete(dto: DeleteDto, req: Request, user?: SessionUser) {
    const board = await this.requireBoard(dto.bo_table, user);
    this.verifyDeleteToken(req, board.boTable, dto.wr_id, dto.token);

    const post = await this.prisma.post.findFirst({
      where: { id: dto.wr_id, boardId: board.id, isComment: false }
    });
    if (!post) {
      throw new NotFoundException('寃뚯떆湲??李얠쓣 ???놁뒿?덈떎.');
    }

    const isAdmin = await this.isBoardAdmin(board, user);
    await this.assertPostOwnerOrAdmin(board, post, user, dto.wr_password);

    const rootId = post.parentId ?? post.id;
    const replyChildrenCount = await this.prisma.post.count({
      where: {
        boardId: board.id,
        isComment: false,
        parentId: rootId,
        id: { not: post.id },
        reply: post.reply ? { startsWith: post.reply } : undefined
      }
    });
    const commentCount = await this.prisma.post.count({
      where: { boardId: board.id, isComment: true, parentId: rootId }
    });

    if (!isAdmin) {
      if (replyChildrenCount > 0 || commentCount > 0) {
        throw new ForbiddenException('?듦?/?볤???議댁옱?섎㈃ ??젣?????놁뒿?덈떎.');
      }
      if (board.boCountDelete > 0 && commentCount >= board.boCountDelete) {
        throw new ForbiddenException('??젣 ?쒗븳 湲곗???珥덇낵?덉뒿?덈떎.');
      }
    }

    const deleteTargets = isAdmin
      ? await this.collectPostDeleteTargets(board.id, post)
      : [{ id: post.id, isComment: false, userId: post.userId }];
    const deleteIds = deleteTargets.map((target) => target.id);
    await this.removeFilesByPostIds(deleteIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.post.deleteMany({ where: { id: { in: deleteIds } } });
      await this.updateNoticeIds(tx, board.id, deleteIds, false);

      const deletedWriteCount = deleteTargets.filter((target) => !target.isComment).length;
      const deletedCommentCount = deleteTargets.filter((target) => target.isComment).length;
      await tx.board.update({
        where: { id: board.id },
        data: {
          boCountWrite: { decrement: deletedWriteCount },
          boCountComment: { decrement: deletedCommentCount }
        }
      });
    });

    for (const target of deleteTargets) {
      if (target.userId) {
        await this.rollbackPoint(
          target.userId,
          'posts',
          String(target.id),
          target.isComment ? 'comment' : 'write'
        );
      }
    }

    return { ok: true, deletedIds: deleteIds };
  }

  async deleteComment(dto: DeleteCommentDto, req: Request, user?: SessionUser) {
    const board = await this.requireBoard(dto.bo_table, user);
    this.verifyDeleteToken(req, board.boTable, dto.comment_id, dto.token);

    const comment = await this.prisma.post.findFirst({
      where: { id: dto.comment_id, boardId: board.id, isComment: true }
    });
    if (!comment) {
      throw new NotFoundException('?볤???李얠쓣 ???놁뒿?덈떎.');
    }

    const isAdmin = await this.isBoardAdmin(board, user);
    await this.assertPostOwnerOrAdmin(board, comment, user, dto.wr_password);

    const childCount = await this.prisma.post.count({
      where: {
        boardId: board.id,
        isComment: true,
        parentId: comment.parentId,
        commentNo: comment.commentNo,
        id: { not: comment.id },
        commentReply: comment.commentReply ? { startsWith: comment.commentReply } : undefined
      }
    });
    if (!isAdmin && childCount > 0) {
      throw new ForbiddenException('??볤???議댁옱?섎㈃ ??젣?????놁뒿?덈떎.');
    }

    const targets = isAdmin
      ? await this.prisma.post.findMany({
          where: {
            boardId: board.id,
            isComment: true,
            parentId: comment.parentId,
            commentNo: comment.commentNo,
            commentReply: comment.commentReply ? { startsWith: comment.commentReply } : undefined
          },
          select: { id: true, isComment: true, userId: true }
        })
      : [{ id: comment.id, isComment: true, userId: comment.userId }];

    const deleteIds = targets.map((target) => target.id);
    await this.removeFilesByPostIds(deleteIds);

    await this.prisma.$transaction([
      this.prisma.post.deleteMany({ where: { id: { in: deleteIds } } }),
      this.prisma.board.update({
        where: { id: board.id },
        data: { boCountComment: { decrement: deleteIds.length } }
      })
    ]);

    for (const target of targets) {
      if (target.userId) {
        await this.rollbackPoint(target.userId, 'posts', String(target.id), 'comment');
      }
    }

    return { ok: true, deletedIds: deleteIds };
  }

  async password(query: PasswordQueryDto, req: Request) {
    const board = await this.requireBoard(query.bo_table);
    const targetId = query.w === 'x' ? query.comment_id : query.wr_id;
    if (!targetId) {
      throw new BadRequestException('???ID媛 ?꾩슂?⑸땲??');
    }

    const tokenKey = `ss_pw_token_${query.w}_${board.boTable}_${targetId}`;
    const token = this.issueToken(req, tokenKey);

    return {
      ok: true,
      token,
      tokenKey,
      bo_table: board.boTable,
      w: query.w,
      targetId
    };
  }

  async passwordCheck(dto: PasswordCheckDto, req: Request) {
    const board = await this.requireBoard(dto.bo_table);
    const post = await this.prisma.post.findFirst({
      where: {
        id: dto.wr_id,
        boardId: board.id,
        isComment: dto.w === 'sc'
      }
    });
    if (!post) {
      throw new NotFoundException('寃뚯떆臾쇱쓣 李얠쓣 ???놁뒿?덈떎.');
    }
    if (!post.passwordHash) {
      throw new BadRequestException('鍮꾨?踰덊샇 蹂댄샇 湲???꾨떃?덈떎.');
    }

    const ok = await compare(dto.wr_password, post.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.');
    }

    this.getSession(req)[`ss_secret_${board.boTable}_${post.id}`] = true;
    if (post.parentId && post.parentId !== post.id) {
      this.getSession(req)[`ss_secret_${board.boTable}_${post.parentId}`] = true;
    }
    return { ok: true };
  }

  async search(query: SearchQueryDto, _req: Request, user?: SessionUser) {
    const page = Math.max(query.page ?? 1, 1);
    const rows = Math.min(Math.max(query.srows ?? 20, 1), 100);
    const skip = (page - 1) * rows;

    const boardWhere: Prisma.BoardWhereInput = { boUseSearch: true };
    if (query.gr_id) {
      boardWhere.group = { grId: query.gr_id };
    }
    if (query.onetable) {
      boardWhere.boTable = query.onetable;
    }

    const boards = await this.prisma.board.findMany({
      where: boardWhere,
      include: {
        group: {
          select: {
            id: true,
            grId: true,
            subject: true,
            adminUserId: true,
            useAccess: true
          }
        }
      }
    });

    const accessibleBoardIds: number[] = [];
    for (const board of boards) {
      if (await this.canAccessBoard(board, user)) {
        accessibleBoardIds.push(board.id);
      }
    }

    if (accessibleBoardIds.length === 0) {
      return { ok: true, page, rows, totalCount: 0, totalPage: 1, posts: [] };
    }

    const where: Prisma.PostWhereInput = {
      boardId: { in: accessibleBoardIds },
      isComment: false
    };
    const searchWhere = this.buildSearchWhere(query.sfl, query.stx, query.sop);
    if (searchWhere) {
      where.AND = [searchWhere];
    }

    const [count, posts] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: rows,
        select: {
          id: true,
          boardId: true,
          subject: true,
          categoryName: true,
          createdAt: true,
          hit: true,
          good: true,
          nogood: true,
          name: true,
          board: {
            select: {
              boTable: true,
              subject: true
            }
          }
        }
      })
    ]);

    return {
      ok: true,
      page,
      rows,
      totalCount: count,
      totalPage: Math.max(1, Math.ceil(count / rows)),
      posts
    };
  }

  private async viewBoardPost(
    board: BoardWithGroup,
    wrId: number,
    req: Request,
    user?: SessionUser
  ) {
    this.ensureLevel(board.boReadLevel, user, 'Read permission denied.');

    const post = await this.prisma.post.findFirst({
      where: { id: wrId, boardId: board.id },
      include: {
        files: { orderBy: { fileNo: 'asc' } },
        user: {
          select: { id: true, loginId: true, nick: true, level: true }
        }
      }
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    await this.ensureReadablePost(board, post, req, user);

    const rootId = post.parentId ?? post.id;
    const viewKey = `ss_view_${board.boTable}_${rootId}`;
    if (!post.isComment && !this.getSession(req)[viewKey]) {
      await this.prisma.post.update({
        where: { id: post.id },
        data: { hit: { increment: 1 } }
      });
      this.getSession(req)[viewKey] = true;
    }

    const comments = await this.prisma.post.findMany({
      where: {
        boardId: board.id,
        isComment: true,
        parentId: rootId
      },
      orderBy: [{ commentNo: 'asc' }, { commentReply: 'asc' }],
      select: {
        id: true,
        commentNo: true,
        commentReply: true,
        content: true,
        optionsCsv: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        name: true,
        user: {
          select: { id: true, loginId: true, nick: true, level: true }
        }
      }
    });

    return {
      ok: true,
      board: this.exposeBoard(board),
      post,
      comments
    };
  }

  private async createPost(
    board: BoardWithGroup,
    dto: WriteUpdateDto,
    files: Express.Multer.File[],
    req: Request,
    user?: SessionUser
  ) {
    this.ensureLevel(board.boWriteLevel, user, 'Write permission denied.');

    const subject = (dto.wr_subject ?? '').trim();
    if (!subject) {
      throw new BadRequestException('Subject is required.');
    }

    const content = dto.wr_content?.trim() ?? '';
    this.validateTextLength(content, board.boWriteMin, board.boWriteMax, 'content');

    const author = await this.resolveAuthor(dto, user);
    const optionsCsv = this.buildOptions('', dto.secret, dto.html, board.boUseSecret === 2);
    const num = await this.nextRootNum(board.id);

    const created = await this.prisma.post.create({
      data: {
        boardId: board.id,
        num,
        reply: '',
        parentId: null,
        isComment: false,
        commentNo: 0,
        commentReply: '',
        categoryName: board.boUseCategory ? dto.ca_name ?? '' : '',
        optionsCsv,
        subject,
        content,
        seoTitle: subject.slice(0, 120),
        link1: dto.wr_link1 ?? '',
        link2: dto.wr_link2 ?? '',
        fileCount: 0,
        userId: author.userId,
        passwordHash: author.passwordHash,
        name: author.name,
        email: author.email,
        homepage: author.homepage,
        ip: this.clientIp(req),
        lastAt: new Date()
      }
    });

    await this.prisma.post.update({
      where: { id: created.id },
      data: { parentId: created.id }
    });

    await this.saveFiles(board, created.id, files, dto.bf_content);
    await this.prisma.board.update({
      where: { id: board.id },
      data: { boCountWrite: { increment: 1 } }
    });

    if (dto.notice !== undefined && (await this.isBoardAdmin(board, user))) {
      await this.updateNoticeIds(this.prisma, board.id, [created.id], this.truthy(dto.notice));
    }

    if (author.userId && board.boWritePoint !== 0) {
      await this.grantPoint(author.userId, board.boWritePoint, 'Post write', 'posts', String(created.id), 'write');
    }

    return {
      ok: true,
      wr_id: created.id,
      url: `/bbs/board?bo_table=${board.boTable}&wr_id=${created.id}`
    };
  }

  private async replyPost(
    board: BoardWithGroup,
    dto: WriteUpdateDto,
    files: Express.Multer.File[],
    req: Request,
    user?: SessionUser
  ) {
    this.ensureLevel(board.boReplyLevel, user, 'Reply permission denied.');
    if (!dto.wr_id) {
      throw new BadRequestException('Parent post id is required.');
    }

    const parent = await this.prisma.post.findFirst({
      where: { id: dto.wr_id, boardId: board.id, isComment: false }
    });
    if (!parent) {
      throw new NotFoundException('Parent post not found.');
    }

    const depth = parent.reply.length + 1;
    if (depth > MAX_REPLY_DEPTH) {
      throw new BadRequestException('Reply depth exceeded.');
    }

    const subject = (dto.wr_subject ?? '').trim();
    if (!subject) {
      throw new BadRequestException('Subject is required.');
    }

    const content = dto.wr_content?.trim() ?? '';
    this.validateTextLength(content, board.boWriteMin, board.boWriteMax, 'content');

    const rootId = parent.parentId ?? parent.id;
    const next = await this.nextReplyChar(board.id, rootId, parent.reply, board.boReplyOrder);
    const author = await this.resolveAuthor(dto, user);
    const optionsCsv = this.buildOptions('', dto.secret, dto.html, board.boUseSecret === 2);

    const created = await this.prisma.post.create({
      data: {
        boardId: board.id,
        num: parent.num,
        reply: `${parent.reply}${next}`,
        parentId: rootId,
        isComment: false,
        commentNo: 0,
        commentReply: '',
        categoryName: board.boUseCategory ? dto.ca_name ?? '' : '',
        optionsCsv,
        subject,
        content,
        seoTitle: subject.slice(0, 120),
        link1: dto.wr_link1 ?? '',
        link2: dto.wr_link2 ?? '',
        fileCount: 0,
        userId: author.userId,
        passwordHash: author.passwordHash,
        name: author.name,
        email: author.email,
        homepage: author.homepage,
        ip: this.clientIp(req),
        lastAt: new Date()
      }
    });

    await this.saveFiles(board, created.id, files, dto.bf_content);
    await this.prisma.$transaction([
      this.prisma.board.update({
        where: { id: board.id },
        data: { boCountWrite: { increment: 1 } }
      }),
      this.prisma.boardNews.create({
        data: {
          boardId: board.id,
          postId: created.id,
          parentId: parent.id,
          userId: author.userId
        }
      })
    ]);

    if (author.userId && board.boWritePoint !== 0) {
      await this.grantPoint(author.userId, board.boWritePoint, 'Post reply', 'posts', String(created.id), 'write');
    }

    return {
      ok: true,
      wr_id: created.id,
      url: `/bbs/board?bo_table=${board.boTable}&wr_id=${created.id}`
    };
  }

  private async updatePost(
    board: BoardWithGroup,
    dto: WriteUpdateDto,
    files: Express.Multer.File[],
    req: Request,
    user?: SessionUser
  ) {
    if (!dto.wr_id) {
      throw new BadRequestException('Post id is required.');
    }

    const post = await this.prisma.post.findFirst({
      where: { id: dto.wr_id, boardId: board.id, isComment: false }
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const isAdmin = await this.isBoardAdmin(board, user);
    await this.assertPostOwnerOrAdmin(board, post, user, dto.wr_password);

    if (!isAdmin && board.boCountModify > 0) {
      const rootId = post.parentId ?? post.id;
      const commentCount = await this.prisma.post.count({
        where: { boardId: board.id, isComment: true, parentId: rootId }
      });
      if (commentCount >= board.boCountModify) {
        throw new ForbiddenException('Modify threshold exceeded.');
      }
    }

    const subject = (dto.wr_subject ?? '').trim();
    if (!subject) {
      throw new BadRequestException('Subject is required.');
    }
    const content = dto.wr_content?.trim() ?? '';
    this.validateTextLength(content, board.boWriteMin, board.boWriteMax, 'content');

    const optionsCsv = this.buildOptions(post.optionsCsv, dto.secret, dto.html, board.boUseSecret === 2);
    await this.prisma.post.update({
      where: { id: post.id },
      data: {
        categoryName: board.boUseCategory ? dto.ca_name ?? '' : '',
        subject,
        content,
        seoTitle: subject.slice(0, 120),
        link1: dto.wr_link1 ?? '',
        link2: dto.wr_link2 ?? '',
        optionsCsv,
        name: user ? post.name : dto.wr_name?.trim() || post.name,
        email: user ? post.email : dto.wr_email?.trim() || post.email,
        homepage: user ? post.homepage : dto.wr_homepage?.trim() || post.homepage,
        ip: this.clientIp(req),
        lastAt: new Date()
      }
    });

    await this.saveFiles(board, post.id, files, dto.bf_content);
    if (dto.notice !== undefined && isAdmin) {
      await this.updateNoticeIds(this.prisma, board.id, [post.id], this.truthy(dto.notice));
    }

    return {
      ok: true,
      wr_id: post.id,
      url: `/bbs/board?bo_table=${board.boTable}&wr_id=${post.id}`
    };
  }

  private async createComment(
    board: BoardWithGroup,
    root: Post,
    dto: WriteCommentUpdateDto,
    req: Request,
    user?: SessionUser
  ) {
    const content = dto.wr_content?.trim() ?? '';
    this.validateTextLength(content, board.boCommentMin, board.boCommentMax, 'comment');

    let commentNo = 0;
    let commentReply = '';
    if (dto.comment_id) {
      const parentComment = await this.prisma.post.findFirst({
        where: {
          id: dto.comment_id,
          boardId: board.id,
          isComment: true,
          parentId: root.id
        }
      });
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found.');
      }

      const depth = parentComment.commentReply.length + 1;
      if (depth > MAX_COMMENT_REPLY_DEPTH) {
        throw new BadRequestException('Comment reply depth exceeded.');
      }
      commentNo = parentComment.commentNo;
      const next = await this.nextCommentReplyChar(
        board.id,
        root.id,
        parentComment.commentNo,
        parentComment.commentReply
      );
      commentReply = `${parentComment.commentReply}${next}`;
    } else {
      const max = await this.prisma.post.aggregate({
        where: { boardId: board.id, isComment: true, parentId: root.id },
        _max: { commentNo: true }
      });
      commentNo = (max._max.commentNo ?? 0) + 1;
    }

    const author = await this.resolveCommentAuthor(dto, user);
    const optionsCsv = this.buildOptions('', dto.wr_secret, undefined, board.boUseSecret === 2);
    const created = await this.prisma.post.create({
      data: {
        boardId: board.id,
        num: root.num,
        reply: root.reply,
        parentId: root.id,
        isComment: true,
        commentNo,
        commentReply,
        categoryName: root.categoryName,
        optionsCsv,
        subject: '',
        content,
        seoTitle: '',
        link1: '',
        link2: '',
        fileCount: 0,
        userId: author.userId,
        passwordHash: author.passwordHash,
        name: author.name,
        email: author.email,
        homepage: author.homepage,
        ip: this.clientIp(req),
        lastAt: new Date()
      }
    });

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: root.id },
        data: { lastAt: new Date() }
      }),
      this.prisma.board.update({
        where: { id: board.id },
        data: { boCountComment: { increment: 1 } }
      }),
      this.prisma.boardNews.create({
        data: {
          boardId: board.id,
          postId: created.id,
          parentId: root.id,
          userId: author.userId
        }
      })
    ]);

    if (author.userId && board.boCommentPoint !== 0) {
      await this.grantPoint(
        author.userId,
        board.boCommentPoint,
        'Comment write',
        'posts',
        String(created.id),
        'comment'
      );
    }

    return { ok: true, comment_id: created.id };
  }

  private async updateComment(
    board: BoardWithGroup,
    root: Post,
    dto: WriteCommentUpdateDto,
    req: Request,
    user?: SessionUser
  ) {
    if (!dto.comment_id) {
      throw new BadRequestException('Comment id is required.');
    }

    const comment = await this.prisma.post.findFirst({
      where: {
        id: dto.comment_id,
        boardId: board.id,
        isComment: true,
        parentId: root.id
      }
    });
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    await this.assertPostOwnerOrAdmin(board, comment, user, dto.wr_password);

    const content = dto.wr_content?.trim() ?? '';
    this.validateTextLength(content, board.boCommentMin, board.boCommentMax, 'comment');
    const optionsCsv = this.buildOptions(comment.optionsCsv, dto.wr_secret, undefined, board.boUseSecret === 2);

    await this.prisma.post.update({
      where: { id: comment.id },
      data: {
        content,
        optionsCsv,
        ip: this.clientIp(req),
        lastAt: new Date()
      }
    });

    return { ok: true, comment_id: comment.id };
  }

  private async requireBoard(boTable: string, user?: SessionUser): Promise<BoardWithGroup> {
    const board = await this.prisma.board.findUnique({
      where: { boTable },
      include: {
        group: {
          select: {
            id: true,
            grId: true,
            subject: true,
            adminUserId: true,
            useAccess: true
          }
        }
      }
    });
    if (!board) {
      throw new NotFoundException('Board not found.');
    }
    if (!(await this.canAccessBoard(board, user))) {
      throw new ForbiddenException('Group access denied.');
    }
    return board;
  }

  private async canAccessBoard(board: BoardWithGroup, user?: SessionUser) {
    if (!board.group.useAccess) {
      return true;
    }
    if (await this.isBoardAdmin(board, user)) {
      return true;
    }
    if (!user) {
      return false;
    }

    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: board.groupId,
          userId: user.id
        }
      },
      select: { id: true }
    });
    return Boolean(member);
  }

  private async isBoardAdmin(board: BoardWithGroup, user?: SessionUser) {
    if (!user) {
      return false;
    }
    if (user.level >= SUPER_LEVEL) {
      return true;
    }
    return board.adminUserId === user.id || board.group.adminUserId === user.id;
  }

  private ensureLevel(required: number, user: SessionUser | undefined, message: string) {
    const level = user?.level ?? 1;
    if (level < required) {
      throw new ForbiddenException(message);
    }
  }

  private getSession(req: Request): SessionBag {
    return req.session as unknown as SessionBag;
  }

  private issueToken(req: Request, key: string) {
    const token = randomToken(16);
    this.getSession(req)[key] = token;
    return token;
  }

  private verifyToken(req: Request, key: string, token: string) {
    const expected = this.getSession(req)[key];
    if (!expected || expected !== token) {
      throw new ForbiddenException('Invalid token.');
    }
  }

  private verifyDeleteToken(req: Request, boTable: string, targetId: number, token: string) {
    const writeToken = this.getSession(req)[`ss_write_token_${boTable}`];
    const dToken = this.getSession(req)[`ss_pw_token_d_${boTable}_${targetId}`];
    const xToken = this.getSession(req)[`ss_pw_token_x_${boTable}_${targetId}`];
    if (token && (token === writeToken || token === dToken || token === xToken)) {
      return;
    }
    throw new ForbiddenException('Invalid delete token.');
  }

  private async ensureReadablePost(
    board: BoardWithGroup,
    post: Pick<Post, 'id' | 'parentId' | 'userId' | 'optionsCsv'>,
    req: Request,
    user?: SessionUser
  ) {
    const isSecret = board.boUseSecret === 2 || hasSecretOption(post.optionsCsv);
    if (!isSecret) {
      return;
    }
    if (await this.isBoardAdmin(board, user)) {
      return;
    }
    if (user && post.userId && user.id === post.userId) {
      return;
    }

    const secretKey = `ss_secret_${board.boTable}_${post.id}`;
    if (this.getSession(req)[secretKey]) {
      return;
    }
    if (post.parentId && this.getSession(req)[`ss_secret_${board.boTable}_${post.parentId}`]) {
      return;
    }

    throw new ForbiddenException('Secret post access denied.');
  }

  private async assertPostOwnerOrAdmin(
    board: BoardWithGroup,
    post: Pick<Post, 'userId' | 'passwordHash'>,
    user?: SessionUser,
    guestPassword?: string
  ) {
    if (await this.isBoardAdmin(board, user)) {
      return;
    }

    if (post.userId) {
      if (!user || post.userId !== user.id) {
        throw new ForbiddenException('Owner only.');
      }
      return;
    }

    if (!guestPassword) {
      throw new UnauthorizedException('Guest password required.');
    }
    const ok = await compare(guestPassword, post.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid password.');
    }
  }

  private async resolveAuthor(
    dto: WriteUpdateDto,
    user?: SessionUser
  ): Promise<{ userId: number | null; passwordHash: string; name: string; email: string; homepage: string }> {
    if (user) {
      const member = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, homepage: true, status: true }
      });
      if (!member || member.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid user session.');
      }
      return {
        userId: member.id,
        passwordHash: '',
        name: member.name,
        email: dto.wr_email?.trim() || member.email || '',
        homepage: dto.wr_homepage?.trim() || member.homepage || ''
      };
    }

    const name = dto.wr_name?.trim();
    const password = dto.wr_password?.trim();
    if (!name || !password) {
      throw new BadRequestException('Guest requires name and password.');
    }
    return {
      userId: null,
      passwordHash: await hash(password, 10),
      name,
      email: dto.wr_email?.trim() ?? '',
      homepage: dto.wr_homepage?.trim() ?? ''
    };
  }

  private async resolveCommentAuthor(
    dto: WriteCommentUpdateDto,
    user?: SessionUser
  ): Promise<{ userId: number | null; passwordHash: string; name: string; email: string; homepage: string }> {
    if (user) {
      const member = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, homepage: true, status: true }
      });
      if (!member || member.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid user session.');
      }
      return {
        userId: member.id,
        passwordHash: '',
        name: member.name,
        email: dto.wr_email?.trim() || member.email || '',
        homepage: dto.wr_homepage?.trim() || member.homepage || ''
      };
    }

    const name = dto.wr_name?.trim();
    const password = dto.wr_password?.trim();
    if (!name || !password) {
      throw new BadRequestException('Guest requires name and password.');
    }
    return {
      userId: null,
      passwordHash: await hash(password, 10),
      name,
      email: dto.wr_email?.trim() ?? '',
      homepage: dto.wr_homepage?.trim() ?? ''
    };
  }

  private buildOptions(current: string, secret?: string, html?: string, forceSecret?: boolean) {
    const options = parseOptionsCsv(current);
    if (forceSecret || secret === 'secret' || secret === '1' || secret === 'true') {
      options.add('secret');
    } else if (secret === 'clear' || secret === '0' || secret === 'false') {
      options.delete('secret');
    }
    if (html) {
      options.add(`html${html}`);
    } else {
      options.delete('html1');
      options.delete('html2');
    }
    return buildOptionsCsv(options);
  }

  private validateTextLength(value: string, min: number, max: number, label: string) {
    const text = value.replace(/<[^>]*>/g, '').trim();
    if (min > 0 && text.length < min) {
      throw new BadRequestException(`${label} shorter than minimum.`);
    }
    if (max > 0 && text.length > max) {
      throw new BadRequestException(`${label} exceeds maximum.`);
    }
  }

  private async nextRootNum(boardId: number) {
    const min = await this.prisma.post.aggregate({
      where: { boardId, isComment: false },
      _min: { num: true }
    });
    return (min._min.num ?? 0) - 1;
  }

  private async nextReplyChar(boardId: number, rootId: number, prefix: string, replyOrder: number) {
    const depth = prefix.length + 1;
    const replies = await this.prisma.post.findMany({
      where: {
        boardId,
        isComment: false,
        parentId: rootId,
        reply: { startsWith: prefix }
      },
      select: { reply: true }
    });

    const chars = replies
      .map((item) => item.reply.charAt(depth - 1))
      .filter((char) => /^[A-Z]$/.test(char));
    if (chars.length === 0) {
      return replyOrder === 1 ? 'A' : 'Z';
    }

    const codes = chars.map((char) => char.charCodeAt(0));
    if (replyOrder === 1) {
      const nextCode = Math.max(...codes) + 1;
      if (nextCode > 90) {
        throw new BadRequestException('Reply branch limit exceeded.');
      }
      return String.fromCharCode(nextCode);
    }

    const nextCode = Math.min(...codes) - 1;
    if (nextCode < 65) {
      throw new BadRequestException('Reply branch limit exceeded.');
    }
    return String.fromCharCode(nextCode);
  }

  private async nextCommentReplyChar(boardId: number, rootId: number, commentNo: number, prefix: string) {
    const depth = prefix.length + 1;
    const replies = await this.prisma.post.findMany({
      where: {
        boardId,
        isComment: true,
        parentId: rootId,
        commentNo,
        commentReply: { startsWith: prefix }
      },
      select: { commentReply: true }
    });

    const chars = replies
      .map((item) => item.commentReply.charAt(depth - 1))
      .filter((char) => /^[A-Z]$/.test(char));
    if (chars.length === 0) {
      return 'A';
    }

    const nextCode = Math.max(...chars.map((char) => char.charCodeAt(0))) + 1;
    if (nextCode > 90) {
      throw new BadRequestException('Comment branch limit exceeded.');
    }
    return String.fromCharCode(nextCode);
  }

  private async saveFiles(board: BoardWithGroup, postId: number, files: Express.Multer.File[], fileDesc?: string) {
    if (!files || files.length === 0) {
      return;
    }
    const existing = await this.prisma.boardFile.count({
      where: { boardId: board.id, postId }
    });
    if (existing + files.length > board.boUploadCount) {
      throw new BadRequestException('Upload count exceeded.');
    }

    const maxNo = await this.prisma.boardFile.aggregate({
      where: { boardId: board.id, postId },
      _max: { fileNo: true }
    });
    let fileNo = (maxNo._max.fileNo ?? -1) + 1;
    const now = new Date();
    const { yy, mm, dd } = yyyymmdd(now);

    for (const upload of files) {
      if (!upload.buffer) {
        throw new BadRequestException('Memory upload buffer is required.');
      }
      if (upload.size > board.boUploadSize) {
        throw new BadRequestException(`Upload size exceeded: ${upload.originalname}`);
      }

      const ext = path.extname(upload.originalname).replace('.', '').toLowerCase();
      const token = uuidv7();
      const physical = ext ? `${token}.${ext}` : token;
      const storedFilename = `${yy}/${mm}/${dd}/${physical}`;
      const absolutePath = this.resolveStoredFilePath(board.id, storedFilename);

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, upload.buffer);

      const sha256 = createHash('sha256').update(upload.buffer).digest('hex');
      await this.prisma.boardFile.create({
        data: {
          boardId: board.id,
          postId,
          fileNo,
          originalFilename: upload.originalname,
          storedFilename,
          sha256,
          mime: upload.mimetype || 'application/octet-stream',
          ext,
          size: upload.size,
          width: 0,
          height: 0,
          fileDesc: fileDesc ?? ''
        }
      });
      fileNo += 1;
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { fileCount: { increment: files.length } }
    });
  }

  private resolveStoredFilePath(boardId: number, storedFilename: string) {
    return path.resolve(env.UPLOAD_ROOT, String(boardId), storedFilename);
  }

  private async removeFilesByPostIds(postIds: number[]) {
    if (postIds.length === 0) {
      return;
    }
    const files = await this.prisma.boardFile.findMany({
      where: { postId: { in: postIds } },
      select: { boardId: true, storedFilename: true }
    });
    for (const file of files) {
      const absolutePath = this.resolveStoredFilePath(file.boardId, file.storedFilename);
      await fs.rm(absolutePath, { force: true }).catch(() => undefined);
    }
  }

  private async grantPoint(
    userId: number,
    point: number,
    content: string,
    relTable: string,
    relId: string,
    relAction: string
  ) {
    try {
      await this.prisma.$transaction([
        this.prisma.point.create({
          data: {
            userId,
            point,
            content,
            relTable,
            relId,
            relAction
          }
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { point: { increment: point } }
        })
      ]);
    } catch {
      return;
    }
  }

  private async rollbackPoint(userId: number, relTable: string, relId: string, relAction: string) {
    const point = await this.prisma.point.findUnique({
      where: {
        userId_relTable_relId_relAction: {
          userId,
          relTable,
          relId,
          relAction
        }
      }
    });
    if (!point) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { point: { decrement: point.point } }
      }),
      this.prisma.point.delete({ where: { id: point.id } })
    ]);
  }

  private buildSearchWhere(sfl?: string, stx?: string, sop?: string): Prisma.PostWhereInput | null {
    const keyword = stx?.trim();
    if (!keyword) {
      return null;
    }

    const operator = (sop ?? 'or').toLowerCase() === 'and' ? 'AND' : 'OR';
    const tokens = keyword.split(/\s+/).filter(Boolean);
    const fields = this.resolveSearchFields(sfl);
    const tokenConditions = tokens.map((token) => ({
      OR: fields.map((field) => ({ [field]: { contains: token } }))
    }));

    return { [operator]: tokenConditions } as Prisma.PostWhereInput;
  }

  private resolveSearchFields(sfl?: string): Array<'subject' | 'content' | 'name'> {
    if (sfl === 'subject') {
      return ['subject'];
    }
    if (sfl === 'content') {
      return ['content'];
    }
    if (sfl === 'name') {
      return ['name'];
    }
    return ['subject', 'content'];
  }

  private async collectPostDeleteTargets(boardId: number, post: Post) {
    const rootId = post.parentId ?? post.id;
    if (!post.reply) {
      return this.prisma.post.findMany({
        where: {
          boardId,
          OR: [{ id: rootId }, { parentId: rootId }]
        },
        select: { id: true, isComment: true, userId: true }
      });
    }
    return this.prisma.post.findMany({
      where: {
        boardId,
        isComment: false,
        parentId: rootId,
        reply: { startsWith: post.reply }
      },
      select: { id: true, isComment: true, userId: true }
    });
  }

  private async updateNoticeIds(
    tx: PrismaService | Prisma.TransactionClient,
    boardId: number,
    targetIds: number[],
    add: boolean
  ) {
    const board = await tx.board.findUnique({
      where: { id: boardId },
      select: { boNotice: true }
    });
    if (!board) {
      return;
    }

    const next = new Set(splitNoticeList(board.boNotice));
    for (const id of targetIds) {
      if (add) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }

    await tx.board.update({
      where: { id: boardId },
      data: { boNotice: joinNoticeList(Array.from(next)) }
    });
  }

  private exposeBoard(board: BoardWithGroup) {
    return {
      id: board.id,
      boTable: board.boTable,
      subject: board.subject,
      groupId: board.groupId,
      group: board.group,
      boListLevel: board.boListLevel,
      boReadLevel: board.boReadLevel,
      boWriteLevel: board.boWriteLevel,
      boReplyLevel: board.boReplyLevel,
      boCommentLevel: board.boCommentLevel,
      boUploadLevel: board.boUploadLevel,
      boDownloadLevel: board.boDownloadLevel,
      boUseSecret: board.boUseSecret,
      boUseGood: board.boUseGood,
      boUseNogood: board.boUseNogood,
      boUseCategory: board.boUseCategory,
      boCategoryList: board.boCategoryList,
      boReplyOrder: board.boReplyOrder,
      boCountModify: board.boCountModify,
      boCountDelete: board.boCountDelete,
      boUploadCount: board.boUploadCount,
      boUploadSize: board.boUploadSize,
      boReadPoint: board.boReadPoint,
      boWritePoint: board.boWritePoint,
      boCommentPoint: board.boCommentPoint,
      boDownloadPoint: board.boDownloadPoint,
      boUseSearch: board.boUseSearch,
      boNotice: splitNoticeList(board.boNotice)
    };
  }

  private clientIp(req: Request) {
    const xfwd = req.headers['x-forwarded-for'];
    if (typeof xfwd === 'string') {
      return xfwd.split(',')[0].trim();
    }
    return req.ip || '';
  }

  private truthy(raw: string) {
    const value = raw.toLowerCase();
    return value === '1' || value === 'true' || value === 'on' || value === 'notice';
  }
}
