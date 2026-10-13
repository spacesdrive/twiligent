import React from 'react';
import { ADMIN_EMAIL, adminMailto } from '@/lib/contact';
import { A } from '../../components';

export default function AdminLink({ subject }) {
  return <A href={adminMailto(subject)}>{ADMIN_EMAIL}</A>;
}
