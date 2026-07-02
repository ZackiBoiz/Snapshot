const {
    REST,
    Routes,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ApplicationCommandOptionType
} = require("discord.js");
require("dotenv").config();

const commands = [
    new SlashCommandBuilder()
        .setName("widget")
        .setDescription("Manage widgets")
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ])
        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription("Get authorization links and set up your widget.")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("reset")
                .setDescription("Reset your widget fields back to default templates.")
        )
        .addSubcommandGroup(group =>
            group
                .setName("manage")
                .setDescription("Active widget control tools.")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("builder")
                        .setDescription("Open the interactive widget panel.")
                        .addBooleanOption(o => o.setName("ephemeral").setDescription("Whether the panel should only be visible to you (default: false)"))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("set")
                        .setDescription("Explicitly set property values via options.")
                        .addStringOption(o => o.setName("activitylabel").setDescription("Value for activityLabel"))
                        .addStringOption(o => o.setName("activitydescription").setDescription("Value for activityDescription"))
                        .addStringOption(o => o.setName("bottomdescription").setDescription("Value for bottomDescription"))
                        .addStringOption(o => o.setName("bottomtitle").setDescription("Value for bottomTitle"))
                        .addStringOption(o => o.setName("minidescription").setDescription("Value for miniDescription"))
                        .addStringOption(o => o.setName("minilabel").setDescription("Value for miniLabel"))
                        .addStringOption(o => o.setName("toptitle").setDescription("Value for topTitle"))
                        .addStringOption(o => o.setName("topsub1").setDescription("Value for topSub1"))
                        .addStringOption(o => o.setName("topsub2").setDescription("Value for topSub2"))
                        .addStringOption(o => o.setName("topsub3").setDescription("Value for topSub3"))
                        .addIntegerOption(o => o.setName("bottomprogress").setDescription("Value for bottomProgress (0..100)"))
                        .addStringOption(o => o.setName("activityicon").setDescription("URL for activityIcon"))
                        .addStringOption(o => o.setName("bottomimage").setDescription("URL for bottomImage"))
                        .addStringOption(o => o.setName("minithumbnail").setDescription("URL for miniThumbnail"))
                        .addStringOption(o => o.setName("miniicon").setDescription("URL for miniIcon"))
                        .addStringOption(o => o.setName("previewthumbnail").setDescription("URL for previewThumbnail"))
                        .addStringOption(o => o.setName("topimage").setDescription("URL for topImage"))
                        .addStringOption(o => o.setName("topsub1icon").setDescription("URL for topSub1Icon"))
                        .addStringOption(o => o.setName("topsub2icon").setDescription("URL for topSub2Icon"))
                        .addStringOption(o => o.setName("topsub3icon").setDescription("URL for topSub3Icon"))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("export")
                        .setDescription("Download widget state as a JSON file.")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("import")
                        .setDescription("Upload/apply a valid layout JSON file.")
                        .addAttachmentOption(o =>
                            o.setName("file")
                             .setDescription("The JSON file to import")
                             .setRequired(true)
                        )
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName("snapshot")
                .setDescription("Local backup and snapshot tools.")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("create")
                        .setDescription("Save your current snapshot to restore to or share with others.")
                        .addStringOption(o => o.setName("title").setDescription("The title of your snapshot"))
                        .addStringOption(o => o.setName("description").setDescription("A brief description of your snapshot"))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("restore")
                        .setDescription("Preview and restore a widget snapshot by ID.")
                        .addStringOption(o => o.setName("id").setDescription("The ID to restore to").setRequired(true).setAutocomplete(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("remove")
                        .setDescription("Permanently delete your widget snapshot.")
                        .addStringOption(o =>
                            o.setName("id")
                             .setDescription("The ID of the snapshot to remove")
                             .setRequired(true)
                             .setAutocomplete(true)
                        )
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName("community")
                .setDescription("External interaction tools.")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("gallery")
                        .setDescription("Browse global public layout registry.")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("search")
                        .setDescription("Search text library matching keywords.")
                        .addStringOption(o => o.setName("query").setDescription("Search term matching ID, title, or description"))
                        .addUserOption(o => o.setName("user").setDescription("Filter snapshots created by a specific user"))
                )
        )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Registering updated slash commands...");
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
        for (const command of commands) {
            const subcommands = command.options.filter(c => c.type === ApplicationCommandOptionType.Subcommand);
            const groups = command.options.filter(c => c.type === ApplicationCommandOptionType.SubcommandGroup);
            console.log(`/${command.name} -> ${subcommands.length} subcommands, ${groups.length} subcommand groups`);
            for (const subcommand of subcommands) {
                console.log(`  /${command.name} ${subcommand.name}`);
            }
            for (const group of groups) {
                console.log(`  /${command.name} ${group.name} -> ${group.options?.length || 0} subcommands`);
                for (const subcommand of group.options || []) {
                    console.log(`    /${command.name} ${group.name} ${subcommand.name}`);
                }
            }
        }
    } catch (error) {
        console.error(error);
    }
})();