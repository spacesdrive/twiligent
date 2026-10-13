import React from 'react';
import { DocTitle, P, A, Code, Callout, Steps, Step } from '../../components';

export default function Cloudinary() {
  return (
    <>
      <DocTitle title="Cloudinary" lead="Instagram publishes from a public URL, so files are uploaded to Cloudinary first." />
      <Steps>
        <Step title="Create an account">
          <P>Sign up at <A href="https://cloudinary.com/users/register_free">cloudinary.com</A>. On the dashboard, copy the <strong>Cloud name</strong>. This is <Code>CLOUDINARY_CLOUD_NAME</Code>.</P>
        </Step>
        <Step title="Create an unsigned upload preset">
          <P>Open <strong>Settings</strong>, then <strong>Upload</strong>, then <strong>Upload presets</strong>, and choose <strong>Add upload preset</strong>. Set <strong>Signing mode</strong> to <strong>Unsigned</strong> and save. Copy the preset name. This is <Code>CLOUDINARY_UPLOAD_PRESET</Code>.</P>
        </Step>
      </Steps>
      <Callout type="note" title="Why unsigned">
        <p>Browsers upload large videos straight to Cloudinary so they never pass through the Worker. Unsigned presets allow this without exposing your Cloudinary API secret. Both values are only handed to signed-in members.</p>
      </Callout>
      <P>Without Cloudinary, everything works except publishing and uploading screenshots for tracked Reddit posts.</P>
    </>
  );
}
