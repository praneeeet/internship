// create-submission.dto.ts
export class CreateSubmissionDto {
  company_name: string;
  role: string;
  start_date: string;
  end_date: string;
  supervisor_name: string;
  supervisor_email: string;
  tutor_email: string;
  description: string;
  document_url?: string | null; // ✅ allow null
}
