export enum ArgType {
    URL,
    String,
    BigInt,
    Unknown,
    TextChannel,
    OverwritePermission,
    Number,
    User,
    Date,
    Guild,
    RoleOrUser,
    Invite,
    Permission,
    Json,
    Color,
    Enum,
    ForumTag,
    Emoji,
    GuildEmoji,
    Boolean,
    Attachment,
    Reaction,
    Message,
    Channel,
    Role,
    Webhook,
    Sticker,
    Time,
    Member,
    ApplicationEmoji,
    AutomodRule,
    ScheduledEvent,
    StageInstance,
    SoundboardSound,
    Template
}

export interface IMetadataArg {
    name: string
    description: string
    type: keyof typeof ArgType

    enum?: any[]
    enumName?: string

    /**
     * Arg index to look at when a type requires a previously guild arg or depends on something.
     */
    pointer?: number
    pointerProperty?: string

    condition?: boolean
    delimiter?: string

    /**
     * Defaults to `false`.
     */
    required?: boolean

    /**
     * Whether this argument is an array of values.
     */
    rest: boolean
}

export interface IMetadataFunction {
    name: `$${string}`
    description: string
    experimental?: boolean
    deprecated?: boolean
    category?: string

    /**
     * @deprecated Not being used.
     */
    examples?: string[]

    /**
     * Resolves all arguments and are passed through execute params.
     */
    unwrap: boolean
    args?: IMetadataArg[]
    output?: Array<keyof typeof ArgType>

    /**
     * Do not provide this.
     */
    version?: string

    /**
     * Aliases this function has.
     */
    aliases?: `$${string}`[]

    /**
     * If `undefined`, function has no brackets.
     *
     * If `false`, function can have brackets.
     *
     * If `true`, function must have brackets.
     */
    brackets?: boolean
}

export interface IForgeFunctionParam {
    name: string
    type?: ArgType | keyof typeof ArgType
    required?: boolean
    rest?: boolean
}

export interface IForgeFunction {
    name: string
    params?: Array<string | IForgeFunctionParam>
    firstParamCondition?: boolean
    brackets?: boolean
    code: string
    path?: string
}