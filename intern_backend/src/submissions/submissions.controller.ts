import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/students.entity';
import { Staff } from '../entities/staffs.entity';
import { Submission } from '../entities/submissions.entity';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { MailService } from '../mail/mail.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Review } from '../entities/reviews.entity';
import { In } from 'typeorm';
import { Department } from '../entities/departments.entity';
import { Class } from '../entities/classes.entity';

@Controller('submissions')
export class SubmissionsController {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>, // Inject Class repository
    private readonly mailService: MailService,
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>, // Add this
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
async createSubmission(@Body() dto: CreateSubmissionDto, @Req() req: Request) {
  const payload = req.user as { email: string; role: string; sub: string };

  if (!payload || payload.role !== 'student') {
    throw new HttpException('Unauthorized: Only students can submit', HttpStatus.UNAUTHORIZED);
  }

  const student = await this.studentRepo.findOne({
    where: { email: payload.email },
    relations: ['class'], // fetch student's class relation
  });
  if (!student) {
    throw new HttpException('Student not found', HttpStatus.NOT_FOUND);
  }

  const tutor = await this.staffRepo.findOne({ where: { email: dto.tutor_email } });
  if (!tutor) {
    throw new HttpException('Tutor email does not exist in staff records', HttpStatus.BAD_REQUEST);
  }

  // 👉 Assign tutor to class if not already assigned
  if (student.class) {
    const studentClass = await this.classRepo.findOne({
      where: { id: student.class.id },
      relations: ['tutor'],
    });

    if (studentClass && (!studentClass.tutor || studentClass.tutor.id !== tutor.id)) {
      studentClass.tutor = tutor;
      await this.classRepo.save(studentClass);
      console.log(`Assigned tutor ${tutor.name} to class ${studentClass.name}`);
    }
  }

  const submissionData = {
    company_name: dto.company_name,
    role: dto.role,
    start_date: new Date(dto.start_date),
    end_date: new Date(dto.end_date),
    supervisor_name: dto.supervisor_name,
    supervisor_email: dto.supervisor_email,
    description: dto.description || null,
    document_url: dto.document_url || null,
    student: student,
    tutor_id: tutor.id,
    processed: false,
  };

  const submission = this.submissionRepo.create(submissionData as any);
  await this.submissionRepo.save(submission);

  try {
    await this.mailService.sendTutorNotification(tutor.email, student.name, student.rollNumber);
  } catch (error) {
    console.error('Failed to send email:', error);
  }

  return {
    success: true,
    message: 'Submission recorded successfully and tutor assigned to class',
  };
}


@Get('admin/overview')
async getAdminOverview(@Req() req: Request) {
  const payload = req.user as { email: string; role: string };



  // Fetch all accepted submissions with related data
  const submissions = await this.submissionRepo.find({
    where: { processed: true },
    relations: ['student', 'student.class', 'student.class.department'],
  });

  const grouped: Record<string, Record<string, { studentName: string; companyName: string }[]>> = {};

  for (const submission of submissions) {
    const dept = submission.student.class?.department?.name || 'Unknown Department';
    const cls = submission.student.class?.name || 'Unknown Class';

    if (!grouped[dept]) grouped[dept] = {};
    if (!grouped[dept][cls]) grouped[dept][cls] = [];

    grouped[dept][cls].push({
      studentName: submission.student.name,
      companyName: submission.company_name,
    });
  }

  return {
    success: true,
    overview: grouped,
  };
}


  @Get('pending')
  @UseGuards(AuthGuard('jwt'))
  async getPendingSubmissions(@Req() req: Request) {
    const payload = req.user as { email: string; role: string; sub: string };
    if (!payload || payload.role !== 'staff') {
      throw new HttpException('Unauthorized: Only tutors can view pending submissions', HttpStatus.UNAUTHORIZED);
    }

    const tutor = await this.staffRepo.findOne({ where: { email: payload.email } });
    if (!tutor) {
      throw new HttpException('Tutor not found', HttpStatus.NOT_FOUND);
    }

    const submissions = await this.submissionRepo.find({
      where: { tutor_id: tutor.id, processed: false },
      relations: ['student'],
    });
    return {
      success: true,
      submissions: submissions.map((s) => ({
        id: s.id,
        studentName: s.student.name,
        rollNumber: s.student.rollNumber,
        company_name: s.company_name,
        role: s.role,
        start_date: s.start_date,
        end_date: s.end_date,
      })),
    };
  }

  @Get('accepted-submissions/class')
  @UseGuards(AuthGuard('jwt'))
  async getAcceptedSubmissionsByClass(@Req() req: Request) {
    const payload = req.user as { email: string; role: string; sub: string };
    if (!payload || payload.role !== 'staff') {
      throw new HttpException('Unauthorized: Only tutors can access this', HttpStatus.UNAUTHORIZED);
    }

    const tutor = await this.staffRepo.findOne({ where: { email: payload.email } });
    if (!tutor) throw new HttpException('Tutor not found', HttpStatus.NOT_FOUND);

    const submissions = await this.submissionRepo.find({
      where: { tutor_id: tutor.id, processed: true },
      relations: ['student'],
    });

    const result = submissions.map((s) => ({
      id: s.id,
      studentName: s.student.name,
      rollNumber: s.student.rollNumber,
      class: s.student.class?.name || 'Unknown',
      company_name: s.company_name,
      role: s.role,
      start_date: s.start_date,
      end_date: s.end_date,
    }));

    return {
      success: true,
      count: result.length,
      submissions: result,
    };
  }

  @Patch(':id/decision')
  @UseGuards(AuthGuard('jwt'))
  async updateSubmissionDecision(
    @Param('id') id: string,
    @Body() dto: { status: 'accepted' | 'declined'; remarks?: string },
    @Req() req: Request,
  ) {
    const payload = req.user as { email: string; role: string; sub: string };
    if (!payload || payload.role !== 'staff') {
      throw new HttpException('Unauthorized: Only tutors can update decisions', HttpStatus.UNAUTHORIZED);
    }

    const submission = await this.submissionRepo.findOne({ where: { id }, relations: ['student'] });
    if (!submission) {
      throw new HttpException('Submission not found', HttpStatus.NOT_FOUND);
    }

    const staff = await this.staffRepo.findOne({ where: { email: payload.email } });
    if (!staff || submission.tutor_id !== staff.id) {
      throw new HttpException('Unauthorized: Only the assigned tutor can update this submission', HttpStatus.UNAUTHORIZED);
    }

    if (dto.status === 'accepted') {
      submission.processed = true;
      await this.submissionRepo.save(submission);
    } else if (dto.status === 'declined') {
      const review = this.reviewRepo.create({
        submissionId: submission.id,
        staffId: staff.id,
        remarks: dto.remarks || null,
      });
      console.log('Review before save:', review);
      await this.reviewRepo.save(review);
      console.log('Review after save:', await this.reviewRepo.findOne({ where: { id: review.id } }));

      submission.processed = true;
      await this.submissionRepo.save(submission);
    }

    try {
      await this.mailService.sendStudentNotification(
        submission.student.email,
        submission.student.name,
        dto.status,
        dto.remarks || 'No remarks provided',
      );
    } catch (error) {
      console.error('Failed to send email:', error);
    }

    return {
      success: true,
      message: `Submission ${dto.status} successfully`,
      submissionId: submission.id,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMySubmissions(@Req() req: Request) {
    console.log('Request user:', req.user);
    const payload = req.user as { email: string; role: string; sub: string };
    if (!payload || payload.role !== 'student') {
      throw new HttpException('Unauthorized: Only students can view their submissions', HttpStatus.UNAUTHORIZED);
    }

    const student = await this.studentRepo.findOne({ where: { email: payload.email }, relations: ['submissions'] });
    if (!student) {
      throw new HttpException('Student not found', HttpStatus.NOT_FOUND);
    }

      const submissionIds = student.submissions.map((s) => s.id);
      const reviews = await this.reviewRepo
        .createQueryBuilder('review')
        .where('review.submission_id::uuid IN (:...ids)', { ids: submissionIds })
        .leftJoinAndSelect('review.submission', 'submission')
        .leftJoinAndSelect('review.staff', 'staff')
        .getMany();
      console.log('Fetched reviews with submissionIds:', submissionIds, 'Result:', reviews);

    const submissionsWithStatus = await Promise.all(
      student.submissions.map(async (submission) => {
        const review = reviews.find((r) => r.submissionId === submission.id);
        const tutor = await this.staffRepo.findOne({ where: { id: submission.tutor_id } });
        return {
          id: submission.id,
          company_name: submission.company_name,
          role: submission.role,
          start_date: submission.start_date,
          end_date: submission.end_date,
          tutorEmail: tutor?.email || 'Unassigned',
          status: review ? review.status : submission.processed ? 'accepted' : 'pending',
          remarks: review?.remarks || null,
        };
      }),
    );

    return {
      success: true,
      submissions: submissionsWithStatus,
      reviews: reviews.map((r) => ({
        id: r.id,
        company_name: r.submission.company_name,
        role: r.submission.role,
        start_date: r.submission.start_date,
        end_date: r.submission.end_date,
        status: r.status,
        remarks: r.remarks || 'No remarks',
        reviewedBy: r.staff?.name || 'Unknown Tutor',
        createdAt: r.createdAt,
      })),
    };
  }
  
@Get('departments')
@UseGuards(AuthGuard('jwt'))
async getAllDepartments() {
  const departments = await this.departmentRepo.find();
  return {
    success: true,
    departments,
  };
}

@Post('me/select-department')
@UseGuards(AuthGuard('jwt'))
async selectDepartment(@Req() req: Request, @Body() body: { departmentId: string }) {
  const payload = req.user as { email: string; role: string };
  if (!payload || payload.role !== 'student') {
    throw new HttpException('Unauthorized: Only students can select department', HttpStatus.UNAUTHORIZED);
  }

  const student = await this.studentRepo.findOne({
    where: { email: payload.email },
  });
  if (!student) {
    throw new HttpException('Student not found', HttpStatus.NOT_FOUND);
  }

  const department = await this.departmentRepo.findOne({ where: { id: body.departmentId } });
  if (!department) {
    throw new HttpException('Department not found', HttpStatus.BAD_REQUEST);
  }

  student.department = department;
  await this.studentRepo.save(student);
  console.log(`Student ${payload.email} selected department ${department.name}`);

  return {
    success: true,
    message: 'Department selected successfully',
    department: department.name,
  };
}
@Get('me/profile')
@UseGuards(AuthGuard('jwt'))
async getMyProfile(@Req() req: Request) {
  const payload = req.user as { email: string; role: string };
  if (!payload || payload.role !== 'student') {
    throw new HttpException('Unauthorized: Only students can view profile', HttpStatus.UNAUTHORIZED);
  }

  const student = await this.studentRepo.findOne({
    where: { email: payload.email },
    relations: ['department', 'class'],
  });

  if (!student) {
    throw new HttpException('Student not found', HttpStatus.NOT_FOUND);
  }

  if (!student.department) {
    return {
      success: true,
      message: 'Please select a department before viewing or creating a class',
      student: {
        id: student.id,
        email: student.email,
        name: student.name,
        rollNumber: student.rollNumber,
        year: student.year,
        department: null,
        class: null,
      },
    };
  }

  const className = payload.email.slice(0, 4).toUpperCase();

  let studentClass: Class | null = await this.classRepo.findOne({
    where: { name: className, department: { id: student.department.id } },
    relations: ['department'],
  });

  if (!studentClass) {
    studentClass = this.classRepo.create({
      id: className, // assuming manual ID
      name: className,
      department: student.department,
    });
    studentClass = await this.classRepo.save(studentClass);
    console.log(`Created new class: ${className} for department ${student.department.name}`);
  } else {
    console.log(`Reusing existing class: ${className}`);
  }

  // Now studentClass is guaranteed to be defined
  if (!student.class || student.class.id !== studentClass.id) {
    student.class = studentClass;
    await this.studentRepo.save(student);
  }

  return {
    success: true,
    student: {
      id: student.id,
      email: student.email,
      name: student.name,
      rollNumber: student.rollNumber,
      year: student.year,
      department: student.department.name,
      class: studentClass.name,
    },
  };
}


  @Patch('me/update-profile')
  @UseGuards(AuthGuard('jwt'))
  async updateMyProfile(@Req() req: Request, @Body() body: {
    rollNumber?: string;
    year?: number;
    departmentId?: string;
  }) {
    const payload = req.user as { email: string; role: string };

    if (!payload || payload.role !== 'student') {
      throw new HttpException('Unauthorized: Only students can update profile', HttpStatus.UNAUTHORIZED);
    }

    const student = await this.studentRepo.findOne({
      where: { email: payload.email },
      relations: ['department'],
    });

    if (!student) {
      throw new HttpException('Student not found', HttpStatus.NOT_FOUND);
    }

    if (body.rollNumber !== undefined) student.rollNumber = body.rollNumber;
    if (body.year !== undefined) student.year = body.year;
    if (body.departmentId !== undefined) {
      const department = await this.staffRepo.manager.getRepository(Department).findOne({
        where: { id: body.departmentId },
      });
      if (!department) {
        throw new HttpException('Invalid department ID', HttpStatus.BAD_REQUEST);
      }
      student.department = department;
    }

    await this.studentRepo.save(student);

    return {
      success: true,
      message: 'Profile updated successfully',
      student: {
        id: student.id,
        email: student.email,
        name: student.name,
        rollNumber: student.rollNumber,
        year: student.year,
        department: student.department?.name || 'Unknown',
      },
    };
  }
}