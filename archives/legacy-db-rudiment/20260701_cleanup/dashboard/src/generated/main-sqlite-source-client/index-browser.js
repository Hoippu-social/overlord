
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  detectRuntime,
} = require('./runtime/index-browser')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.7.0
 * Query Engine version: 79fb5193cf0a8fdbef536e4b4a159cad677ab1b9
 */
Prisma.prismaVersion = {
  client: "5.7.0",
  engine: "79fb5193cf0a8fdbef536e4b4a159cad677ab1b9"
}

Prisma.PrismaClientKnownRequestError = () => {
  throw new Error(`PrismaClientKnownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  throw new Error(`PrismaClientUnknownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientRustPanicError = () => {
  throw new Error(`PrismaClientRustPanicError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientInitializationError = () => {
  throw new Error(`PrismaClientInitializationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientValidationError = () => {
  throw new Error(`PrismaClientValidationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.NotFoundError = () => {
  throw new Error(`NotFoundError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  throw new Error(`sqltag is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.empty = () => {
  throw new Error(`empty is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.join = () => {
  throw new Error(`join is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.raw = () => {
  throw new Error(`raw is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  throw new Error(`Extensions.getExtensionContext is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.defineExtension = () => {
  throw new Error(`Extensions.defineExtension is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.AiModerationCategoryRuleScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  category: 'category',
  enabled: 'enabled',
  threshold: 'threshold',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiModerationConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  enabled: 'enabled',
  provider: 'provider',
  model: 'model',
  defaultThreshold: 'defaultThreshold',
  scanEdits: 'scanEdits',
  includedChannels: 'includedChannels',
  excludedChannels: 'excludedChannels',
  exemptRoles: 'exemptRoles',
  exemptUsers: 'exemptUsers',
  customPolicyPrompt: 'customPolicyPrompt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiModerationIncidentScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  messageId: 'messageId',
  channelId: 'channelId',
  authorId: 'authorId',
  excerpt: 'excerpt',
  summary: 'summary',
  categories: 'categories',
  provider: 'provider',
  model: 'model',
  confidence: 'confidence',
  status: 'status',
  reviewerId: 'reviewerId',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppealConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  enabled: 'enabled',
  appealChannelId: 'appealChannelId',
  pardonLogChannelId: 'pardonLogChannelId',
  allowUserAppeals: 'allowUserAppeals',
  allowDirectPardon: 'allowDirectPardon',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  settingsJson: 'settingsJson'
};

exports.Prisma.AppealTicketScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  caseId: 'caseId',
  caseNumber: 'caseNumber',
  userId: 'userId',
  appealType: 'appealType',
  status: 'status',
  message: 'message',
  resolutionNote: 'resolutionNote',
  reviewerId: 'reviewerId',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogEventScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  tag: 'tag',
  actorId: 'actorId',
  targetId: 'targetId',
  channelId: 'channelId',
  messageId: 'messageId',
  payload: 'payload',
  severity: 'severity',
  createdAt: 'createdAt'
};

exports.Prisma.AuditTagRouteScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  tag: 'tag',
  channelId: 'channelId',
  enabled: 'enabled',
  template: 'template',
  mentions: 'mentions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomodCustomRuleScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  name: 'name',
  ruleType: 'ruleType',
  pattern: 'pattern',
  enabled: 'enabled',
  action: 'action',
  strikeWeight: 'strikeWeight',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomodRuleConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  ruleKey: 'ruleKey',
  enabled: 'enabled',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomodSanctionStepScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  triggerStrikeCount: 'triggerStrikeCount',
  actionType: 'actionType',
  durationMinutes: 'durationMinutes',
  enabled: 'enabled',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BotSettingsScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  locale: 'locale',
  timezone: 'timezone',
  prefixCommandsEnabled: 'prefixCommandsEnabled',
  commandChannelMode: 'commandChannelMode',
  allowedTextChannels: 'allowedTextChannels',
  adminRoles: 'adminRoles',
  restoreRolesOnRejoin: 'restoreRolesOnRejoin',
  restoreNicknameOnRejoin: 'restoreNicknameOnRejoin',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GuildScalarFieldEnum = {
  id: 'id',
  prefix: 'prefix',
  name: 'name',
  icon: 'icon',
  channels: 'channels',
  roles: 'roles',
  memberCount: 'memberCount',
  onlineCount: 'onlineCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GuildTimezoneHistoryScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  timezone: 'timezone',
  source: 'source',
  effectiveFrom: 'effectiveFrom',
  createdAt: 'createdAt'
};

exports.Prisma.InviteSnapshotScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  code: 'code',
  inviterId: 'inviterId',
  uses: 'uses',
  maxUses: 'maxUses',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InviteUseEventScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  memberId: 'memberId',
  inviterId: 'inviterId',
  code: 'code',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt',
  stayDurationSec: 'stayDurationSec',
  voiceDurationSec: 'voiceDurationSec',
  createdAt: 'createdAt'
};

exports.Prisma.MessageEventScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  messageId: 'messageId',
  authorId: 'authorId',
  eventType: 'eventType',
  isBot: 'isBot',
  contentBefore: 'contentBefore',
  contentAfter: 'contentAfter',
  createdAt: 'createdAt',
  attachmentsAfter: 'attachmentsAfter',
  attachmentsBefore: 'attachmentsBefore'
};

exports.Prisma.ModerationCaseScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  caseNumber: 'caseNumber',
  actionType: 'actionType',
  source: 'source',
  actorUserId: 'actorUserId',
  targetUserId: 'targetUserId',
  reason: 'reason',
  status: 'status',
  expiresAt: 'expiresAt',
  relatedCaseId: 'relatedCaseId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ModerationCaseNoteScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  caseId: 'caseId',
  actorUserId: 'actorUserId',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.ModerationCommandGrantScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  roleId: 'roleId',
  scopeType: 'scopeType',
  scopeKey: 'scopeKey',
  effect: 'effect',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ModerationConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  muteRoleId: 'muteRoleId',
  ignoredChannels: 'ignoredChannels',
  ignoredRoles: 'ignoredRoles',
  ignoredUsers: 'ignoredUsers',
  commandOnlyChannels: 'commandOnlyChannels',
  aiProvider: 'aiProvider',
  aiModel: 'aiModel',
  aiDefaultThreshold: 'aiDefaultThreshold',
  aiScanEdits: 'aiScanEdits',
  aiIncludedChannels: 'aiIncludedChannels',
  aiExcludedChannels: 'aiExcludedChannels',
  aiExemptRoles: 'aiExemptRoles',
  aiExemptUsers: 'aiExemptUsers',
  aiCustomPolicyPrompt: 'aiCustomPolicyPrompt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  commandRules: 'commandRules'
};

exports.Prisma.ModerationRoleBindingScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  roleId: 'roleId',
  title: 'title',
  accessLevel: 'accessLevel',
  enabled: 'enabled',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MusicConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelMode: 'channelMode',
  allowedChannels: 'allowedChannels',
  djMode: 'djMode',
  djRoles: 'djRoles',
  defaultVolume: 'defaultVolume',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MusicNowPlayingScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  title: 'title',
  author: 'author',
  uri: 'uri',
  artworkUrl: 'artworkUrl',
  durationMs: 'durationMs',
  positionMs: 'positionMs',
  volume: 'volume',
  paused: 'paused',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.RetentionPolicyScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  category: 'category',
  strategy: 'strategy',
  ttlDays: 'ttlDays',
  enabled: 'enabled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StatActivityScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  name: 'name',
  startTime: 'startTime',
  endTime: 'endTime',
  duration: 'duration',
  sessionKey: 'sessionKey'
};

exports.Prisma.StatChannelDailyScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  date: 'date',
  messages: 'messages',
  voiceSeconds: 'voiceSeconds',
  interactions: 'interactions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StatDailyScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  date: 'date',
  messages: 'messages',
  voiceSeconds: 'voiceSeconds',
  newMembers: 'newMembers',
  leftMembers: 'leftMembers',
  maxOnline: 'maxOnline'
};

exports.Prisma.StatHourlyScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  dateHour: 'dateHour',
  messages: 'messages',
  voiceSeconds: 'voiceSeconds',
  newMembers: 'newMembers',
  leftMembers: 'leftMembers'
};

exports.Prisma.StatInteractionScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  fromUserId: 'fromUserId',
  toUserId: 'toUserId',
  type: 'type',
  channelId: 'channelId',
  createdAt: 'createdAt',
  interactionKey: 'interactionKey'
};

exports.Prisma.StatMemberCountScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  online: 'online',
  idle: 'idle',
  dnd: 'dnd',
  offline: 'offline',
  total: 'total',
  createdAt: 'createdAt'
};

exports.Prisma.StatMemberDailyScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  date: 'date',
  messages: 'messages',
  voiceSeconds: 'voiceSeconds',
  interactions: 'interactions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StatMemberEventScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  eventType: 'eventType',
  eventKey: 'eventKey',
  source: 'source',
  createdAt: 'createdAt'
};

exports.Prisma.StatMessageScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  authorId: 'authorId',
  length: 'length',
  createdAt: 'createdAt',
  sourceMessageId: 'sourceMessageId'
};

exports.Prisma.StatTopChannelScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  period: 'period',
  category: 'category',
  value: 'value',
  updatedAt: 'updatedAt'
};

exports.Prisma.StatTopMemberScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  period: 'period',
  category: 'category',
  value: 'value',
  updatedAt: 'updatedAt'
};

exports.Prisma.StatVoiceStateScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  userId: 'userId',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt',
  duration: 'duration',
  sessionKey: 'sessionKey'
};

exports.Prisma.StatsAggregationStateScalarFieldEnum = {
  guildId: 'guildId',
  timezone: 'timezone',
  schemaVersion: 'schemaVersion',
  sourceHighWatermark: 'sourceHighWatermark',
  rebuildRequired: 'rebuildRequired',
  jobStatus: 'jobStatus',
  lastSuccessfulRebuildAt: 'lastSuccessfulRebuildAt',
  lastSourceEventAt: 'lastSourceEventAt',
  lastReadModelSyncAt: 'lastReadModelSyncAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StatsJobScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  jobType: 'jobType',
  status: 'status',
  payload: 'payload',
  attempts: 'attempts',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  error: 'error',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TempVoiceConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  hubChannelId: 'hubChannelId',
  interfaceChannelId: 'interfaceChannelId',
  categoryId: 'categoryId',
  nameTemplate: 'nameTemplate',
  userLimit: 'userLimit',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TempVoiceRoomScalarFieldEnum = {
  id: 'id',
  channelId: 'channelId',
  ownerId: 'ownerId',
  guildId: 'guildId',
  hubChannelId: 'hubChannelId',
  createdAt: 'createdAt'
};

exports.Prisma.TicketScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  number: 'number',
  threadId: 'threadId',
  categoryId: 'categoryId',
  itemId: 'itemId',
  authorId: 'authorId',
  claimedBy: 'claimedBy',
  status: 'status',
  formAnswers: 'formAnswers',
  participants: 'participants',
  closedBy: 'closedBy',
  closeReason: 'closeReason',
  lastActivityAt: 'lastActivityAt',
  transcript: 'transcript',
  transcriptToken: 'transcriptToken',
  deleteAfterAt: 'deleteAfterAt',
  rating: 'rating',
  createdAt: 'createdAt',
  closedAt: 'closedAt'
};

exports.Prisma.TicketCategoryScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  name: 'name',
  channelId: 'channelId',
  panelMessageId: 'panelMessageId',
  nameTemplate: 'nameTemplate',
  closeAction: 'closeAction',
  autoDeleteHours: 'autoDeleteHours',
  saveHistory: 'saveHistory',
  mentionAgents: 'mentionAgents',
  allowUserClose: 'allowUserClose',
  splitLogs: 'splitLogs',
  enableRating: 'enableRating',
  agentRoles: 'agentRoles',
  messageText: 'messageText',
  messageEmbeds: 'messageEmbeds',
  buttonText: 'buttonText',
  buttonEmoji: 'buttonEmoji',
  buttonStyle: 'buttonStyle',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TicketConfigScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  enabled: 'enabled',
  logChannelId: 'logChannelId',
  maxOpenPerUser: 'maxOpenPerUser',
  cooldownSeconds: 'cooldownSeconds',
  transcriptRetentionDays: 'transcriptRetentionDays',
  nextTicketNumber: 'nextTicketNumber',
  blacklist: 'blacklist',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TicketEventScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  ticketId: 'ticketId',
  eventType: 'eventType',
  actorUserId: 'actorUserId',
  note: 'note',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.TicketFormQuestionScalarFieldEnum = {
  id: 'id',
  categoryId: 'categoryId',
  label: 'label',
  type: 'type',
  required: 'required',
  placeholder: 'placeholder',
  order: 'order'
};

exports.Prisma.TicketItemScalarFieldEnum = {
  id: 'id',
  categoryId: 'categoryId',
  type: 'type',
  label: 'label',
  description: 'description',
  emoji: 'emoji',
  replyContent: 'replyContent',
  agentRoles: 'agentRoles',
  requiredRoles: 'requiredRoles'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  balance: 'balance',
  xp: 'xp',
  level: 'level',
  lastDaily: 'lastDaily',
  lastWork: 'lastWork',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserVoiceSettingsScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  preferredName: 'preferredName',
  preferredLimit: 'preferredLimit',
  locked: 'locked',
  blockedUsers: 'blockedUsers',
  allowedUsers: 'allowedUsers',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WarningScalarFieldEnum = {
  id: 'id',
  reason: 'reason',
  userId: 'userId',
  moderatorId: 'moderatorId',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  AiModerationCategoryRule: 'AiModerationCategoryRule',
  AiModerationConfig: 'AiModerationConfig',
  AiModerationIncident: 'AiModerationIncident',
  AppealConfig: 'AppealConfig',
  AppealTicket: 'AppealTicket',
  AuditLogEvent: 'AuditLogEvent',
  AuditTagRoute: 'AuditTagRoute',
  AutomodCustomRule: 'AutomodCustomRule',
  AutomodRuleConfig: 'AutomodRuleConfig',
  AutomodSanctionStep: 'AutomodSanctionStep',
  BotSettings: 'BotSettings',
  Guild: 'Guild',
  GuildTimezoneHistory: 'GuildTimezoneHistory',
  InviteSnapshot: 'InviteSnapshot',
  InviteUseEvent: 'InviteUseEvent',
  MessageEvent: 'MessageEvent',
  ModerationCase: 'ModerationCase',
  ModerationCaseNote: 'ModerationCaseNote',
  ModerationCommandGrant: 'ModerationCommandGrant',
  ModerationConfig: 'ModerationConfig',
  ModerationRoleBinding: 'ModerationRoleBinding',
  MusicConfig: 'MusicConfig',
  MusicNowPlaying: 'MusicNowPlaying',
  RetentionPolicy: 'RetentionPolicy',
  StatActivity: 'StatActivity',
  StatChannelDaily: 'StatChannelDaily',
  StatDaily: 'StatDaily',
  StatHourly: 'StatHourly',
  StatInteraction: 'StatInteraction',
  StatMemberCount: 'StatMemberCount',
  StatMemberDaily: 'StatMemberDaily',
  StatMemberEvent: 'StatMemberEvent',
  StatMessage: 'StatMessage',
  StatTopChannel: 'StatTopChannel',
  StatTopMember: 'StatTopMember',
  StatVoiceState: 'StatVoiceState',
  StatsAggregationState: 'StatsAggregationState',
  StatsJob: 'StatsJob',
  TempVoiceConfig: 'TempVoiceConfig',
  TempVoiceRoom: 'TempVoiceRoom',
  Ticket: 'Ticket',
  TicketCategory: 'TicketCategory',
  TicketConfig: 'TicketConfig',
  TicketEvent: 'TicketEvent',
  TicketFormQuestion: 'TicketFormQuestion',
  TicketItem: 'TicketItem',
  User: 'User',
  UserVoiceSettings: 'UserVoiceSettings',
  Warning: 'Warning'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        const runtime = detectRuntime()
        const edgeRuntimeName = {
          'workerd': 'Cloudflare Workers',
          'deno': 'Deno and Deno Deploy',
          'netlify': 'Netlify Edge Functions',
          'edge-light': 'Vercel Edge Functions',
        }[runtime]

        let message = 'PrismaClient is unable to run in '
        if (edgeRuntimeName !== undefined) {
          message += edgeRuntimeName + '. As an alternative, try Accelerate: https://pris.ly/d/accelerate.'
        } else {
          message += 'this browser environment, or has been bundled for the browser (running in `' + runtime + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://github.com/prisma/prisma/issues`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
