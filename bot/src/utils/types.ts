import {
    ChatInputCommandInteraction,
    ContextMenuCommandInteraction,
    ContextMenuCommandBuilder,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';

export type CommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;
export type CommandData =
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | ContextMenuCommandBuilder;

export type AnyCommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export interface Command<TInteraction extends AnyCommandInteraction = ChatInputCommandInteraction> {
    data: CommandData;
    execute: (interaction: TInteraction) => Promise<void>;
    hidden?: boolean;
    accessGroup?: string;
    accessKey?: string;
    requiredAccessLevel?: number;
}
