// how a rule's keywords are compared with a comment: anywhere as whole words, or as the whole comment
export type AutomationMatchMode = 'contains' | 'exact';

// the life of a received comment; ignored ones matched no rule, the rest are reply jobs
export type AutomationCommentStatus =
    | 'ignored' | 'queued' | 'processing' | 'retry_wait' | 'sending'
    | 'accepted' | 'failed' | 'needs_review' | 'skipped' | 'expired';

// what one private reply request to Instagram ended as
export type AutomationAttemptOutcome = 'sending' | 'accepted' | 'rejected' | 'rate_limited' | 'ambiguous';

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
    comment: string;
    mediaId?: string;
}

export interface AutomationTestResponse {
    success: true;
    matched: boolean;
    // the keyword that matched, or null
    keyword: string | null;
    // the private reply exactly as it would be sent
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
