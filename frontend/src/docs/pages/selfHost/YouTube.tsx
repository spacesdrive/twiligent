import React from 'react';
import { DocTitle, P, A, Code, Callout, Steps, Step } from '../../components';

export default function YouTube() {
  return (
    <>
      <DocTitle title="YouTube API key" lead="One shared key lets every member add any public channel." />
      <Steps>
        <Step title="Create a Google Cloud project">
          <P>Open <A href="https://console.cloud.google.com/projectcreate">Google Cloud Console</A> and create a project, for example <Code>twiligent</Code>.</P>
        </Step>
        <Step title="Enable the YouTube Data API">
          <P>Open <A href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">YouTube Data API v3</A> in the API Library, make sure your new project is selected, and choose <strong>Enable</strong>.</P>
        </Step>
        <Step title="Create the key">
          <P>Open <strong>APIs and Services</strong>, then <A href="https://console.cloud.google.com/apis/credentials">Credentials</A>. Choose <strong>Create credentials</strong>, then <strong>API key</strong>. Copy the key; it starts with <Code>AIza</Code>. This is <Code>YOUTUBE_API_KEY</Code>.</P>
        </Step>
        <Step title="Restrict the key">
          <P>Edit the key. Under <strong>API restrictions</strong> choose <strong>Restrict key</strong> and select only YouTube Data API v3. Leave <strong>Application restrictions</strong> at None, because the key is used by the Worker, not a browser.</P>
        </Step>
      </Steps>
      <Callout type="tip" title="Quota">
        <p>The free quota is 10,000 units a day, shared by all members. Most reads cost 1 unit. Adding <A to="/docs/self-host/redis">Upstash Redis</A> caches results and makes the quota go much further.</p>
      </Callout>
    </>
  );
}
