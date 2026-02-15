import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBoardDto,
  CreateGroupDto,
  UpdateBoardPolicyDto,
  UpdateGroupDto
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listGroups() {
    return this.prisma.group.findMany({
      orderBy: [{ orderNo: 'asc' }, { id: 'asc' }]
    });
  }

  createGroup(dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        grId: dto.gr_id,
        subject: dto.subject,
        adminUserId: dto.admin_user_id ?? null,
        useAccess: dto.use_access ?? false,
        orderNo: dto.order_no ?? 0
      }
    });
  }

  async updateGroup(id: number, dto: UpdateGroupDto) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    return this.prisma.group.update({
      where: { id },
      data: {
        subject: dto.subject,
        adminUserId: dto.admin_user_id,
        useAccess: dto.use_access,
        orderNo: dto.order_no
      }
    });
  }

  listBoards() {
    return this.prisma.board.findMany({
      include: {
        group: {
          select: {
            id: true,
            grId: true,
            subject: true
          }
        }
      },
      orderBy: [{ groupId: 'asc' }, { id: 'asc' }]
    });
  }

  createBoard(dto: CreateBoardDto) {
    return this.prisma.board.create({
      data: {
        boTable: dto.bo_table,
        groupId: dto.group_id,
        subject: dto.subject
      }
    });
  }

  async updateBoard(id: number, dto: UpdateBoardPolicyDto) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) {
      throw new NotFoundException('Board not found.');
    }

    return this.prisma.board.update({
      where: { id },
      data: {
        subject: dto.subject,
        boListLevel: dto.bo_list_level,
        boReadLevel: dto.bo_read_level,
        boWriteLevel: dto.bo_write_level,
        boReplyLevel: dto.bo_reply_level,
        boCommentLevel: dto.bo_comment_level,
        boUploadLevel: dto.bo_upload_level,
        boDownloadLevel: dto.bo_download_level,
        boUseSecret: dto.bo_use_secret,
        boUseGood: dto.bo_use_good,
        boUseNogood: dto.bo_use_nogood,
        boUseSearch: dto.bo_use_search,
        boUseCategory: dto.bo_use_category,
        boCategoryList: dto.bo_category_list,
        boReplyOrder: dto.bo_reply_order,
        boCountModify: dto.bo_count_modify,
        boCountDelete: dto.bo_count_delete,
        boUploadCount: dto.bo_upload_count,
        boUploadSize: dto.bo_upload_size,
        boReadPoint: dto.bo_read_point,
        boWritePoint: dto.bo_write_point,
        boCommentPoint: dto.bo_comment_point,
        boDownloadPoint: dto.bo_download_point
      }
    });
  }
}
