// how a rule's keywords are compared with a comment: anywhere as whole words, or as the whole comment; any answers
// every comment with text in it and has no keywords
export type AutomationMatchMode = 'contains' | 'exact' | 'any';

// the life of a received comment; ignored ones matched no rule, the rest are reply jobs
export type AutomationCommentStatus =
    | 'ignored' | 'queued' | 'processing' | 'retry_wait' | 'sending'
    | 'accepted' | 'failed' | 'needs_review' | 'skipped' | 'expired';

// what one private reply request to Instagram ended as
export type AutomationAttemptOutcome = 'sending' | 'accepted' | 'rejected' | 'rate_limited' | 'ambiguous';

// a followers-only reply: waiting for the person to answer, link sent, or every reminder used
export type AutomationGateStatus = 'awaiting_reply' | 'completed' | 'closed';

// the message sent after the person answered: the reply and link once they follow, a reminder otherwise
export type AutomationFollowupKind = 'link' | 'reminder';

// a follow-up message moves through the same states as a reply, except ignored
export type AutomationFollowupStatus = Exclude<AutomationCommentStatus, 'ignored'>;

export interface AutomationRule {
    id: string;
    accountId: string;
    name: string;
    keywords: string[];
    matchMode: AutomationMatchMode;
    caseSensitive: boolean;
    // empty means every post and reel of the account
    mediaIds: string[];
    replyText: string;
    linkUrl: string | null;
    enabled: boolean;
    // null uses only the account's limit
    hourlyLimit: number | null;
    // the private reply asks the person to follow and answer; the reply and link go out once Instagram says they follow
    requireFollow: boolean;
    followPromptText: string | null;
    notFollowingText: string | null;
    createdAt: string;
    updatedAt: string;
}

// body of POST /api/automations/rules
export interface AutomationRuleRequest {
    accountId: string;
    name: string;
    keywords: string[];
    matchMode?: AutomationMatchMode;
    caseSensitive?: boolean;
    mediaIds?: string[];
    replyText: string;
    linkUrl?: string | null;
    enabled?: boolean;
    hourlyLimit?: number | null;
    requireFollow?: boolean;
    followPromptText?: string | null;
    notFollowingText?: string | null;
}

// body of PUT /api/automations/rules/:id; a rule stays on its account
export type AutomationRuleUpdateRequest = Partial<Omit<AutomationRuleRequest, 'accountId'>>;

// one connected Instagram account as the automation sees it
export interface AutomationAccountState {
    accountId: string;
    username: string;
    profilePictureUrl: string;
    paused: boolean;
    cooldownUntil: string | null;
    cooldownReason: string | null;
    // when Instagram confirmed it sends this account's comments to the webhook
    subscribedAt: string | null;
    // the account reached its hourly reply limit; its replies wait until then
    limitedUntil: string | null;
    // Instagram also sends this account's messages, which followers-only rules need
    messagesSubscribed: boolean;
}

export interface AutomationLimits {
    accountHourly: number;
    userHourly: number;
    globalHourly: number;
    recipientDaily: number;
}

export interface AutomationSettings {
    // the webhook secrets are set, so Meta's requests can be verified
    webhookConfigured: boolean;
    // AUTOMATION_PAUSED holds every reply on this instance
    paused: boolean;
    limits: AutomationLimits;
}

export interface AutomationActivityItem {
    id: string;
    accountId: string;
    ruleId: string | null;
    commentId: string;
    mediaId: string | null;
    fromUsername: string | null;
    text: string | null;
    status: AutomationCommentStatus;
    statusReason: string | null;
    errorMessage: string | null;
    attempts: number;
    nextAttemptAt: string | null;
    acceptedAt: string | null;
    expiresAt: string;
    createdAt: string;
    // followers-only rules: where the wait for the person's answer stands, and the latest message sent after it
    gateStatus: AutomationGateStatus | null;
    followup: AutomationFollowupState | null;
}

export interface AutomationFollowupState {
    status: AutomationFollowupStatus;
    kind: AutomationFollowupKind | null;
    errorMessage: string | null;
    createdAt: string;
}

export interface AutomationStats {
    comments: Partial<Record<AutomationCommentStatus, number>>;
    attempts: Partial<Record<AutomationAttemptOutcome, number>>;
}

// GET /api/automations
export interface AutomationOverviewResponse {
    success: true;
    rules: AutomationRule[];
    accounts: AutomationAccountState[];
    settings: AutomationSettings;
}

// POST /api/automations/rules, PUT /api/automations/rules/:id and POST /api/automations/rules/:id/duplicate
export interface AutomationRuleResponse {
    success: true;
    rule: AutomationRule;
}

// body of POST /api/automations/test: a rule draft and a sample comment; nothing is sent
export interface AutomationTestRequest {
    keywords: string[];
    matchMode?: AutomationMatchMode;
    caseSensitive?: boolean;
    mediaIds?: string[];
    replyText: string;
    linkUrl?: string | null;
    requireFollow?: boolean;
    followPromptText?: string | null;
    comment: string;
    mediaId?: string;
}

export interface AutomationTestResponse {
    success: true;
    matched: boolean;
    // the keyword that matched, or null, as for an any-comment rule
    keyword: string | null;
    // the private reply exactly as it would be sent; for a followers-only rule, the request to follow and answer
    message: string;
    messageBytes: number;
    maxMessageBytes: number;
}

// GET /api/automations/activity; pass nextBefore as before for the next page
export interface AutomationActivityResponse {
    success: true;
    items: AutomationActivityItem[];
    nextBefore: string | null;
}

// POST /api/automations/activity/:id/retry
export interface AutomationActivityItemResponse {
    success: true;
    item: AutomationActivityItem;
}

// GET /api/automations/stats
export interface AutomationStatsResponse {
    success: true;
    from: string;
    to: string;
    stats: AutomationStats;
}

// body of PUT /api/automations/accounts/:accountId
export interface AutomationAccountRequest {
    paused: boolean;
}

// PUT /api/automations/accounts/:accountId and POST /api/automations/accounts/:accountId/subscribe
export interface AutomationAccountResponse {
    success: true;
    account: AutomationAccountState;
}
