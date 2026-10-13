import React from 'react';
import { DocTitle, P, A, Steps, Step } from '../../components';

export default function Redis() {
  return (
    <>
      <DocTitle title="Upstash Redis (optional)" lead="A cache that saves YouTube and Instagram quota, makes pages load faster, and makes rate limits exact." />
      <P>Twiligent works fully without Redis. Every cache read falls back to a live API call, and Redis errors are ignored. If Redis stops answering, the backend gives up on it within a few seconds and stops trying for half a minute, so pages keep loading at the speed of the live APIs. Add it when you have several members or many YouTube channels.</P>
      <P>The backend also limits how fast each person and each network can call it, so one client cannot use up the shared YouTube quota. With Redis, those limits are counted once across every Cloudflare location. Without it, each Worker instance counts on its own, so the limits are looser but still apply. There is nothing to configure.</P>
      <Steps>
        <Step title="Create a database">
          <P>Sign in at <A href="https://console.upstash.com">console.upstash.com</A>, choose <strong>Create database</strong>, and pick the region closest to your Supabase project.</P>
        </Step>
        <Step title="Copy the REST values">
          <P>On the database page, in the <strong>REST API</strong> section, copy <strong>UPSTASH_REDIS_REST_URL</strong> and <strong>UPSTASH_REDIS_REST_TOKEN</strong>. They are used under exactly those names.</P>
        </Step>
      </Steps>
    </>
  );
}
