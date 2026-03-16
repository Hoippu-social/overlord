
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
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

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

exports.Prisma.WarningScalarFieldEnum = {
  id: 'id',
  reason: 'reason',
  userId: 'userId',
  moderatorId: 'moderatorId',
  createdAt: 'createdAt'
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
  attachmentsBefore: 'attachmentsBefore',
  attachmentsAfter: 'attachmentsAfter',
  createdAt: 'createdAt'
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

exports.Prisma.StatMessageScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  authorId: 'authorId',
  length: 'length',
  sourceMessageId: 'sourceMessageId',
  createdAt: 'createdAt'
};

exports.Prisma.StatVoiceStateScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  channelId: 'channelId',
  userId: 'userId',
  sessionKey: 'sessionKey',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt',
  duration: 'duration'
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

exports.Prisma.StatMemberEventScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  eventType: 'eventType',
  eventKey: 'eventKey',
  source: 'source',
  createdAt: 'createdAt'
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

exports.Prisma.StatTopMemberScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  period: 'period',
  category: 'category',
  value: 'value',
  updatedAt: 'updatedAt'
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

exports.Prisma.StatActivityScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  userId: 'userId',
  name: 'name',
  sessionKey: 'sessionKey',
  startTime: 'startTime',
  endTime: 'endTime',
  duration: 'duration'
};

exports.Prisma.StatInteractionScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  fromUserId: 'fromUserId',
  toUserId: 'toUserId',
  type: 'type',
  channelId: 'channelId',
  interactionKey: 'interactionKey',
  createdAt: 'createdAt'
};

exports.Prisma.GuildTimezoneHistoryScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  timezone: 'timezone',
  source: 'source',
  effectiveFrom: 'effectiveFrom',
  createdAt: 'createdAt'
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

exports.Prisma.StatsApiRequestMetricScalarFieldEnum = {
  id: 'id',
  guildId: 'guildId',
  endpoint: 'endpoint',
  method: 'method',
  period: 'period',
  statusCode: 'statusCode',
  durationMs: 'durationMs',
  errorCode: 'errorCode',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Guild: 'Guild',
  BotSettings: 'BotSettings',
  MusicConfig: 'MusicConfig',
  Warning: 'Warning',
  TempVoiceConfig: 'TempVoiceConfig',
  TempVoiceRoom: 'TempVoiceRoom',
  UserVoiceSettings: 'UserVoiceSettings',
  MusicNowPlaying: 'MusicNowPlaying',
  MessageEvent: 'MessageEvent',
  AuditLogEvent: 'AuditLogEvent',
  AuditTagRoute: 'AuditTagRoute',
  InviteSnapshot: 'InviteSnapshot',
  InviteUseEvent: 'InviteUseEvent',
  StatMessage: 'StatMessage',
  StatVoiceState: 'StatVoiceState',
  StatMemberCount: 'StatMemberCount',
  StatMemberEvent: 'StatMemberEvent',
  StatHourly: 'StatHourly',
  StatDaily: 'StatDaily',
  StatTopMember: 'StatTopMember',
  StatTopChannel: 'StatTopChannel',
  StatMemberDaily: 'StatMemberDaily',
  StatChannelDaily: 'StatChannelDaily',
  StatActivity: 'StatActivity',
  StatInteraction: 'StatInteraction',
  GuildTimezoneHistory: 'GuildTimezoneHistory',
  StatsAggregationState: 'StatsAggregationState',
  StatsJob: 'StatsJob',
  StatsApiRequestMetric: 'StatsApiRequestMetric'
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
