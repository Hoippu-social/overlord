import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearModeratorNote, createModeratorNote, listCasesForUser } from '../../services/ModerationService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('note')
        .setDescription('Manage private moderation notes')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Add a private moderator note')
                .addUserOption((option) => option.setName('user').setDescription('Target member').setRequired(true))
                .addStringOption((option) => option.setName('text').setDescription('Note text').setRequired(true).setMaxLength(1000))
        )
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('List private notes for a member')
                .addUserOption((option) => option.setName('user').setDescription('Target member').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Clear a private note by case id')
                .addIntegerOption((option) => option.setName('note_id').setDescription('Note case number').setRequired(true).setMinValue(1))
        ),
    accessGroup: 'moderation',
    accessKey: 'note',
    requiredAccessLevel: 40,
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const target = interaction.options.getUser('user', true);
            const text = interaction.options.getString('text', true);
            const noteCase = await createModeratorNote(interaction.guildId, interaction.user.id, target.id, text);
            await interaction.reply({ content: `Note added for <@${target.id}> as case #${noteCase.caseNumber}.`, ephemeral: true });
            return;
        }

        if (subcommand === 'list') {
            const target = interaction.options.getUser('user', true);
            const notes = (await listCasesForUser(interaction.guildId, target.id, 25)).filter((row) => row.actionType === 'NOTE' && row.status === 'INFO');
            if (!notes.length) {
                await interaction.reply({ content: `No private notes for <@${target.id}>.`, ephemeral: true });
                return;
            }
            const lines = notes.map((note) => `#${note.caseNumber} - ${note.reason || 'Empty note'}`);
            await interaction.reply({ content: lines.join('\n').slice(0, 1900), ephemeral: true });
            return;
        }

        const noteId = interaction.options.getInteger('note_id', true);
        const cleared = await clearModeratorNote(interaction.guildId, interaction.user.id, noteId);
        await interaction.reply({ content: `Note #${noteId} cleared. New case #${cleared.caseNumber}.`, ephemeral: true });
    },
};

export default command;
