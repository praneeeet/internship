import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Student } from './students.entity';
import { Staff } from './staffs.entity';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  company_name: string;

  @Column()
  role: string;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column()
  supervisor_name: string;

  @Column()
  supervisor_email: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  document_url: string;

  @ManyToOne(() => Student, student => student.submissions)
  student: Student;

@Column({ type: 'uuid', nullable: true })
  tutor_id: string  ;

  @Column({ default: false })
  processed: boolean; // Track if reviewed
}