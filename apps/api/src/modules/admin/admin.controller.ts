import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AdminService } from './admin.service';
import {
  CreateBoardDto,
  CreateGroupDto,
  UpdateBoardPolicyDto,
  UpdateGroupDto
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('groups')
  async groups() {
    return { ok: true, groups: await this.adminService.listGroups() };
  }

  @Post('groups')
  async createGroup(@Body() dto: CreateGroupDto) {
    return { ok: true, group: await this.adminService.createGroup(dto) };
  }

  @Patch('groups/:id')
  async updateGroup(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGroupDto) {
    return { ok: true, group: await this.adminService.updateGroup(id, dto) };
  }

  @Get('boards')
  async boards() {
    return { ok: true, boards: await this.adminService.listBoards() };
  }

  @Post('boards')
  async createBoard(@Body() dto: CreateBoardDto) {
    return { ok: true, board: await this.adminService.createBoard(dto) };
  }

  @Patch('boards/:id')
  async updateBoard(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoardPolicyDto) {
    return { ok: true, board: await this.adminService.updateBoard(id, dto) };
  }
}
