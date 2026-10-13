import React from 'react';
import { ADMIN_EMAIL, adminMailto } from '@/lib/contact';
import { A } from '../../components';

interface AdminLinkProps {
  subject: string;
}

export default function AdminLink({ subject }: AdminLinkProps) {
  return <A href={adminMailto(subject)}>{ADMIN_EMAIL}</A>;
}
