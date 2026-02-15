import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionUser } from '../../common/types/session';
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
import { BbsService } from './bbs.service';

@Controller('bbs')
export class BbsController {
  constructor(private readonly bbsService: BbsService) {}

  @Get('board')
  board(
    @Query() query: BoardQueryDto,
    @Req() req: Request,
    @CurrentUser() user?: SessionUser
  ) {
    return this.bbsService.board(query, req, user);
  }

  @Get('write')
  write(
    @Query() query: WriteQueryDto,
    @Req() req: Request,
    @CurrentUser() user?: SessionUser
  ) {
    return this.bbsService.writeForm(query, req, user);
  }

  @Post('write_token')
  writeToken(@Body() dto: WriteTokenDto, @Req() req: Request) {
    return this.bbsService.writeToken(dto, req);
  }

  @Post('write_update')
  @UseInterceptors(AnyFilesInterceptor())
  writeUpdate(
    @Body() dto: WriteUpdateDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Req() req: Request,
    @CurrentUser() user?: SessionUser
  ) {
    return this.bbsService.writeUpdate(dto, files, req, user);
  }

  @Post('write_comment_update')
  writeCommentUpdate(
    @Body() dto: WriteCommentUpdateDto,
    @Req() req: Request,
    @CurrentUser() user?: SessionUser
  ) {
    return this.bbsService.writeCommentUpdate(dto, req, user);
  }

  @Get('download')
  async download(
    @Query() query: DownloadQueryDto,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user?: SessionUser
  ) {
    const file = await this.bbsService.download(query, req, user);
    res.download(file.absolutePath, file.originalFilename);
  }

  @Post('good')
  good(@Body() dto: GoodDto, @Req() req: Request, @CurrentUser() user?: SessionUser) {
    return this.bbsService.good(dto, req, user);
  }

  @Post('delete')
  delete(@Body() dto: DeleteDto, @Req() req: Request, @CurrentUser() user?: SessionUser) {
    return this.bbsService.delete(dto, req, user);
  }

  @Post('delete_comment')
  deleteComment(
    @Body() dto: DeleteCommentDto,
    @Req() req: Request,
    @CurrentUser() user?: SessionUser
  ) {
    return this.bbsService.deleteComment(dto, req, user);
  }

  @Get('password')
  password(@Query() query: PasswordQueryDto, @Req() req: Request) {
    return this.bbsService.password(query, req);
  }

  @Post('password_check')
  passwordCheck(@Body() dto: PasswordCheckDto, @Req() req: Request) {
    return this.bbsService.passwordCheck(dto, req);
  }

  @Get('search')
  search(@Query() query: SearchQueryDto, @Req() req: Request, @CurrentUser() user?: SessionUser) {
    return this.bbsService.search(query, req, user);
  }
}
