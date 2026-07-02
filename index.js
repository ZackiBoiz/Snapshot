const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    Events
} = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");
const config = require("./config.json");
require("dotenv").config();

GlobalFonts.registerFromPath("./fonts/ggRegular.woff", "ggRegular");
GlobalFonts.registerFromPath("./fonts/ggMedium.woff", "ggMedium");
GlobalFonts.registerFromPath("./fonts/ggSemibold.woff", "ggSemibold");
GlobalFonts.registerFromPath("./fonts/ggBold.woff", "ggBold");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const DB_PATH = path.join(__dirname, "databases/users.json");
const SNAPSHOT_DB_PATH = path.join(__dirname, "databases/snapshots.json");

const searchCache = new Map();

const SCOPES = ["sdk.social_layer_presence"];

const DEFAULT_WIDGET_DATA = {
    activityLabel: "Activity Label",
    activityDescription: "Activity Description",
    activityIcon: "",
    bottomImage: "",
    bottomProgress: 0,
    bottomDescription: "Bottom Description",
    bottomTitle: "Bottom Title",
    miniDescription: "Mini Description",
    miniThumbnail: "",
    miniLabel: "Mini Label",
    miniIcon: "",
    previewThumbnail: "",
    topImage: "",
    topTitle: "Top Title",
    topSub1: "Top Subtitle 1",
    topSub1Icon: "",
    topSub2: "Top Subtitle 2",
    topSub2Icon: "",
    topSub3: "Top Subtitle 3",
    topSub3Icon: "",
};

const OPTION_MAPPING = [
    { key: "activityLabel", type: 1 }, { key: "activityDescription", type: 1 }, { key: "activityIcon", type: 3 },
    { key: "bottomImage", type: 3 }, { key: "bottomProgress", type: 2 }, { key: "bottomDescription", type: 1 },
    { key: "bottomTitle", type: 1 }, { key: "miniDescription", type: 1 }, { key: "miniThumbnail", type: 3 },
    { key: "miniLabel", type: 1 }, { key: "miniIcon", type: 3 }, { key: "previewThumbnail", type: 3 },
    { key: "topImage", type: 3 }, { key: "topTitle", type: 1 }, { key: "topSub1", type: 1 },
    { key: "topSub1Icon", type: 3 }, { key: "topSub2", type: 1 }, { key: "topSub2Icon", type: 3 },
    { key: "topSub3", type: 1 }, { key: "topSub3Icon", type: 3 }
];

const CATEGORY_KEYS = {
    cat_top: ["topTitle", "topImage", "topSub1", "topSub1Icon", "topSub2", "topSub2Icon", "topSub3", "topSub3Icon"],
    cat_bottom: ["bottomTitle", "bottomDescription", "bottomProgress", "bottomImage"],
    cat_preview: ["previewThumbnail"],
    cat_mini: ["miniLabel", "miniThumbnail", "miniDescription", "miniIcon"],
    cat_activity: ["activityLabel", "activityDescription", "activityIcon"]
};


function getWidgetCommandParts(interaction) {
    return {
        group: interaction.options.getSubcommandGroup(false),
        subcommand: interaction.options.getSubcommand(false)
    };
}

function readDatabase() {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDatabase(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function readSnapshotDatabase() {
    if (!fs.existsSync(SNAPSHOT_DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(SNAPSHOT_DB_PATH, "utf-8"));
}

function writeSnapshotDatabase(data) {
    fs.writeFileSync(SNAPSHOT_DB_PATH, JSON.stringify(data, null, 2));
}

function generateSnapshotId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return y + lineHeight;
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + " ";
        let metrics = ctx.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + " ";
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
}

function drawCardBg(ctx, x, y, w, h, radius = 12) {
    ctx.fillStyle = "#111214";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
}

async function drawUserImage(ctx, url, x, y, w, h, radius = 0) {
    if (!url) {
        ctx.fillStyle = "#2b2d31";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
        return;
    }
    try {
        const img = await loadImage(url);
        ctx.save();

        if ((typeof radius === "number" && radius > 0) || Array.isArray(radius)) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);
            ctx.clip();
        }

        const imgRatio = img.width / img.height;
        const containerRatio = w / h;
        let sx, sy, sw, sh;

        if (imgRatio > containerRatio) {
            sh = img.height;
            sw = img.height * containerRatio;
            sx = (img.width - sw) / 2;
            sy = 0;
        } else {
            sw = img.width;
            sh = img.width / containerRatio;
            sx = 0;
            sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = "#ff3333";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
    }
}

async function paintTopBottomComponent(ctx, widgetData, x, y) {
    const w = 370, h = 230;
    const pBarX = x + 85, pBarY = y + 165, pBarW = 250, pBarH = 6;
    const pBarRadius = pBarH / 2;
    const cardComponentRadius = 12;

    drawCardBg(ctx, x, y, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, cardComponentRadius);
    ctx.closePath();
    ctx.clip();

    await drawUserImage(ctx, widgetData.topImage, x + 190, y, 180, 130, [0, cardComponentRadius, 0, 0]);

    const grad = ctx.createLinearGradient(x + 190, y, x + 340, y);
    grad.addColorStop(0, "#111214");
    grad.addColorStop(1, "rgba(17, 18, 20, 0)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(x + 190, y, 180, 130, [0, cardComponentRadius, 0, 0]);
    ctx.fill();
    ctx.restore();

    await drawUserImage(ctx, client.user.avatarURL(), x + 15, y + 14, 14, 14, 4);

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "12px 'ggMedium'";
    wrapText(ctx, client.user.username, x + 35, y + 25, 160, 22);

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "18px 'ggMedium'";
    wrapText(ctx, widgetData.topTitle, x + 15, y + 55, 160, 22);

    ctx.font = "13px 'ggRegular'";
    ctx.fillStyle = "#b5bac1";

    ctx.fillText(widgetData.topSub1, x + 15, y + 75);
    if (widgetData.topSub1Icon) await drawUserImage(ctx, widgetData.topSub1Icon, x + Math.min(130, ctx.measureText(widgetData.topSub1).width) + 20, y + 64, 14, 14);

    ctx.fillText(widgetData.topSub2, x + 15, y + 95);
    if (widgetData.topSub2Icon) await drawUserImage(ctx, widgetData.topSub2Icon, x + Math.min(130, ctx.measureText(widgetData.topSub2).width) + 20, y + 84, 14, 14);

    ctx.fillText(widgetData.topSub3, x + 15, y + 115);
    if (widgetData.topSub3Icon) await drawUserImage(ctx, widgetData.topSub3Icon, x + Math.min(130, ctx.measureText(widgetData.topSub3).width) + 20, y + 104, 14, 14);

    ctx.fillStyle = "#1e1f22";
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 140, w - 20, 80, 8);
    ctx.fill();
    await drawUserImage(ctx, widgetData.bottomImage, x + 20, y + 155, 50, 50, 8);

    ctx.fillStyle = "#4e5058";
    ctx.beginPath();
    ctx.roundRect(pBarX, pBarY, pBarW, pBarH, pBarRadius);
    ctx.fill();

    ctx.fillStyle = "#f2f3f5";
    const fillPercent = Math.max(0, Math.min(100, widgetData.bottomProgress || 0)) / 100;
    const currentFillWidth = pBarW * fillPercent;

    if (currentFillWidth > 0) {
        ctx.beginPath();
        ctx.roundRect(pBarX, pBarY, currentFillWidth, pBarH, pBarRadius);
        ctx.fill();
    }

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "13px 'ggMedium'";
    ctx.fillText(widgetData.bottomTitle, pBarX, pBarY + 22);
    ctx.font = "12px 'ggRegular'";
    ctx.fillStyle = "#b5bac1";

    wrapText(ctx, widgetData.bottomDescription, pBarX, pBarY + 36, 210, 15);
    ctx.fillStyle = "#f2f3f5";
    ctx.font = "13px 'ggMedium'";
    ctx.fillText(`${widgetData.bottomProgress || 0}%`, x + 315, pBarY + 22);
}

async function paintMiniComponent(ctx, widgetData, x, y) {
    const w = 370, h = 90;
    drawCardBg(ctx, x, y, w, h);
    await drawUserImage(ctx, widgetData.miniThumbnail, x + 285, y + 12, 65, 65, 8);

    await drawUserImage(ctx, client.user.avatarURL(), x + 15, y + 14, 14, 14, 4);

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "12px 'ggMedium'";
    wrapText(ctx, client.user.username, x + 35, y + 25, 160, 22);

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "14px 'ggSemibold'";
    wrapText(ctx, `${widgetData.miniLabel}: ${widgetData.miniDescription}`, x + 15, y + 50, 250, 18);
    ctx.fillStyle = "#b5bac1";

    if (widgetData.miniIcon) await drawUserImage(ctx, widgetData.miniIcon, x + Math.min(130, ctx.measureText(`${widgetData.miniLabel}: ${widgetData.miniDescription}`).width) + 20, y + 36, 18, 18);

    ctx.font = "12px 'ggRegular'";
    ctx.fillText("View All Stats", x + 15, y + 72);
}

async function paintPreviewComponent(ctx, widgetData, x, y) {
    const w = 370, h = 230;
    drawCardBg(ctx, x, y, w, h);
    await drawUserImage(ctx, widgetData.previewThumbnail, x + 220, y + 20, 130, 130, 10);

    ctx.fillStyle = "#2b2d31";
    ctx.beginPath();
    ctx.roundRect(x + 20, y + 25, 100, 20, 7.5);
    ctx.fill();

    ctx.fillStyle = "#2b2d31";
    ctx.beginPath();

    const startX = x + 20;
    const startY = y + 80;
    const gapX = 10;
    const gapY = 10;
    const tileW = 55;
    const tileH = 30;
    const r = 8;

    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
            ctx.roundRect(
                startX + col * (tileW + gapX),
                startY + row * (tileH + gapY),
                tileW,
                tileH,
                r
            );
        }
    }
    ctx.fill();

    ctx.fillStyle = "#2b2d31";
    ctx.beginPath();
    ctx.roundRect(x + 15, y + 170, w - 30, 45, 8);
    ctx.fill();

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "14px 'ggMedium'";
    ctx.fillText(`Show off your ${client.user.username} stats`, x + 35, y + 197);
}

async function paintActivityComponent(ctx, widgetData, x, y) {
    const w = 370, h = 210;
    drawCardBg(ctx, x, y, w, h);

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "14px 'ggBold'";
    ctx.fillText("Playing", x + 20, y + 30);

    ctx.fillStyle = "#2b2d31";
    ctx.beginPath();
    ctx.roundRect(x + 20, y + 45, 70, 70, 8);
    ctx.roundRect(x + 105, y + 50, 210, 14, 7);
    ctx.roundRect(x + 105, y + 70, 140, 12, 6);
    ctx.roundRect(x + 105, y + 88, 110, 12, 6);
    ctx.fill();

    const now = new Date();
    const hours = now.getUTCHours().toString();
    const minutes = now.getUTCMinutes().toString().padStart(2, "0");
    const seconds = now.getUTCSeconds().toString().padStart(2, "0");
    const currentTime = `${hours}:${minutes}:${seconds}`;

    ctx.fillStyle = "#23a55a";
    ctx.font = "12px ggBold";
    ctx.fillText(currentTime, x + 105, y + 114);

    ctx.fillStyle = "#111214";
    ctx.beginPath();
    ctx.roundRect(x + 15, y + 145, w - 30, 50, 8);
    ctx.fill();

    await drawUserImage(ctx, widgetData.activityIcon, x + 25, y + 155, 30, 30, 4);

    ctx.fillStyle = "#f2f3f5";
    ctx.font = "13px 'ggMedium'";
    wrapText(ctx, `${widgetData.activityLabel}: ${widgetData.activityDescription}`, x + 65, y + 175, 280, 16);
}

async function generateWidgetPreviewBuffer(userObject) {
    let width = 800, height = 512;
    const view = userObject.currentView;
    const widgetData = userObject.widget || DEFAULT_WIDGET_DATA;

    if (view === "cat_top" || view === "cat_bottom" || view === "cat_preview") {
        width = 410; height = 270;
    } else if (view === "cat_mini") {
        width = 410; height = 130;
    } else if (view === "cat_activity") {
        width = 410; height = 250;
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1e1f22";
    ctx.fillRect(0, 0, width, height);

    if (view === "all_views") {
        await paintTopBottomComponent(ctx, widgetData, 20, 20);
        await paintMiniComponent(ctx, widgetData, 410, 20);
        await paintPreviewComponent(ctx, widgetData, 20, 270);
        await paintActivityComponent(ctx, widgetData, 410, 130);
    } else if (view === "cat_top" || view === "cat_bottom") {
        await paintTopBottomComponent(ctx, widgetData, 20, 20);
    } else if (view === "cat_mini") {
        await paintMiniComponent(ctx, widgetData, 20, 20);
    } else if (view === "cat_preview") {
        await paintPreviewComponent(ctx, widgetData, 20, 20);
    } else if (view === "cat_activity") {
        await paintActivityComponent(ctx, widgetData, 20, 20);
    }

    return canvas.toBuffer("image/png");
}

function generateBuilderEmbed(username) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Widget Builder`)
        .setDescription("Select a view or specific subcomponent to check out and modify values.")
        .setImage("attachment://preview.png");
}

function generateControlComponents(currentView = "all_views") {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("wb_select_category")
        .setPlaceholder("Choose view/layout target...")
        .addOptions([
            { label: "Full View", value: "all_views", description: "Display all components at once.", default: currentView === "all_views" },
            { label: "Top Component", value: "cat_top", description: "Displays Top component layout settings.", default: currentView === "cat_top" },
            { label: "Bottom Component", value: "cat_bottom", description: "Displays Bottom component layout settings.", default: currentView === "cat_bottom" },
            { label: "Preview Component", value: "cat_preview", description: "Displays Preview component layout settings.", default: currentView === "cat_preview" },
            { label: "Mini Component", value: "cat_mini", description: "Displays Mini component layout settings.", default: currentView === "cat_mini" },
            { label: "Activity Component", value: "cat_activity", description: "Displays Activity component layout settings.", default: currentView === "cat_activity" }
        ]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder();
    const row3 = new ActionRowBuilder();
    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("wb_btn_close").setLabel("Close").setStyle(ButtonStyle.Secondary)
    )

    if (currentView && currentView !== "all_views") {
        if (currentView === "cat_top") {
            row3.addComponents(
                new ButtonBuilder().setCustomId("wb_btn_edit_cat_top_p1").setLabel("Input Selected Values (1/2)").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("wb_btn_edit_cat_top_p2").setLabel("Input Selected Values (2/2)").setStyle(ButtonStyle.Primary)
            );
        } else {
            row3.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wb_btn_edit_${currentView}`)
                    .setLabel("Input Selected Values")
                    .setStyle(ButtonStyle.Primary)
            );
        }
    }

    row2.addComponents(
        new ButtonBuilder().setCustomId("wb_btn_sync").setLabel("Save & Publish Changes").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("wb_btn_reset_init").setLabel("Factory Reset").setStyle(ButtonStyle.Danger)
    );

    const elements = [row1, row2];
    if (currentView && currentView !== "all_views") {
        elements.push(row3);
    }
    elements.push(row4);

    return elements;
}

function generateRestoreControlComponents(snapshotId, currentView = "all_views") {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`wb_snapshot_select_category_${snapshotId}`)
        .setPlaceholder("Choose view/component target...")
        .addOptions([
            { label: "Full View", value: "all_views", description: "Display all components at once.", default: currentView === "all_views" },
            { label: "Top Component", value: "cat_top", description: "Displays Top component layout settings.", default: currentView === "cat_top" },
            { label: "Bottom Component", value: "cat_bottom", description: "Displays Bottom component layout settings.", default: currentView === "cat_bottom" },
            { label: "Preview Component", value: "cat_preview", description: "Displays Preview component layout settings.", default: currentView === "cat_preview" },
            { label: "Mini Component", value: "cat_mini", description: "Displays Mini component layout settings.", default: currentView === "cat_mini" },
            { label: "Activity Component", value: "cat_activity", description: "Displays Activity component layout settings.", default: currentView === "cat_activity" }
        ]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("wb_snapshot_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`wb_snapshot_confirm_${snapshotId}`).setLabel("Confirm All").setStyle(ButtonStyle.Success)
    );

    if (currentView && currentView !== "all_views") {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`wb_snapshot_partial_${snapshotId}_${currentView}`)
                .setLabel("Confirm this Component")
                .setStyle(ButtonStyle.Primary)
        );
    }

    return [row1, row2];
}

async function syncDiscordWidget(userId, userData) {
    const dynamicData = [];
    const widgetData = userData?.widget || DEFAULT_WIDGET_DATA;

    OPTION_MAPPING.forEach(({ key, type }) => {
        if (widgetData[key] !== undefined && widgetData[key] !== null && widgetData[key] !== "") {
            if (type === 3) {
                dynamicData.push({ type: 3, name: key, value: { url: widgetData[key] } });
            } else if (key === "bottomProgress") {
                const apiFloatValue = Math.max(0, Math.min(100, widgetData[key])) / 100;
                dynamicData.push({ type: type, name: key, value: apiFloatValue });
            } else {
                dynamicData.push({ type: type, name: key, value: widgetData[key] });
            }
        }
    });

    const payload = {
        username: userData.username,
        data: { dynamic: dynamicData }
    };

    let externalUserId = userData.id;
    const url = `https://discord.com/api/v9/applications/${client.user.id ?? process.env.CLIENT_ID}/users/${userId}/identities/${externalUserId}/profile`;
    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        console.log(err);
        switch (response.status) {
            case 403:
                throw new Error("Your user is unauthenticated. Run `/widget setup` to link your account.");
            case 429:
                throw new Error(`Please wait ${err.retry_after}s before updating your widget.`);
            default:
                throw new Error(`Discord API error: ${response.status}\n\`\`\`json\n${JSON.stringify(err, null, 2)}\n\`\`\``);
        }
    }
}

async function renderGalleryPage(interaction, index) {
    const snapshotDb = readSnapshotDatabase();
    const snapshots = Object.keys(snapshotDb)
        .map(id => ({ id, ...snapshotDb[id] }))
        .sort((a, b) => b.createdAt - a.createdAt);

    if (snapshots.length === 0) {
        const embed = new EmbedBuilder().setColor(0x07070b).setDescription("The snapshot gallery is currently empty.");
        return interaction.editReply({ embeds: [embed] });
    }

    const snapshot = snapshots[index];
    const previewData = {
        currentView: "all_views",
        username: snapshot.creatorName,
        widget: { ...DEFAULT_WIDGET_DATA, ...(snapshot.data?.widget || {}) }
    };

    const imgBuffer = await generateWidgetPreviewBuffer(previewData);
    const attachment = new AttachmentBuilder(imgBuffer, { name: "gallery.png" });

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Widget Snapshots Gallery: ${snapshot.title || "Untitled"}`)
        .setDescription(`**ID:** \`${snapshot.id}\`\n**Description:** ${snapshot.description || "None"}\n**Author:** ${snapshot.creatorName || "Unknown"}\n**Date:** <t:${Math.floor(snapshot.createdAt / 1000)}:f>`)
        .setImage("attachment://gallery.png")
        .setFooter({ text: `Snapshot ${index + 1} of ${snapshots.length}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gal_prev_${index}`)
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),
        new ButtonBuilder()
            .setCustomId(`wb_snapshot_confirm_${snapshot.id}`)
            .setLabel("Restore this Snapshot")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`gal_next_${index}`)
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === snapshots.length - 1)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("gal_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({ embeds: [embed], components: [row, row2], files: [attachment] });
}

async function renderSearchPage(interaction, query, userFilterId, pageIndex, isUpdate = false) {
    const snapshotDb = readSnapshotDatabase();
    let results = Object.keys(snapshotDb).map(id => ({ id, ...snapshotDb[id] }));

    if (userFilterId) {
        results = results.filter(s => s.creatorId === userFilterId);
    }

    if (query) {
        const lowerQuery = query.toLowerCase();
        results = results.filter(s =>
            s.id.toLowerCase().includes(lowerQuery) ||
            (s.title && s.title.toLowerCase().includes(lowerQuery)) ||
            (s.description && s.description.toLowerCase().includes(lowerQuery))
        );
    }

    if (results.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0x07070b)
            .setDescription("No snapshots found matching your search parameters.");
        return isUpdate
            ? interaction.editReply({ embeds: [embed], components: [], files: [] })
            : interaction.editReply({ embeds: [embed] });
    }

    const itemsPerPage = 5;
    const totalPages = Math.ceil(results.length / itemsPerPage);
    const startIndex = pageIndex * itemsPerPage;
    const pageItems = results.slice(startIndex, startIndex + itemsPerPage);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Widget Snapshots Library")
        .setDescription(`Found ${results.length} widget snapshots matching search criteria:`)
        .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}` });

    pageItems.forEach(res => {
        embed.addFields({
            name: `${res.title || "Untitled"} (\`${res.id}\`)`,
            value: `Description: *${res.description || "No description provided"}*\nAuthor: **${res.creatorName || "Unknown"}** • Created <t:${Math.floor(res.createdAt / 1000)}:R>`
        });
    });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`search_prev_${pageIndex}`)
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId(`search_next_${pageIndex}`)
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex >= totalPages - 1)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("search_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Secondary)
    );

    const payload = { embeds: [embed], components: [row1, row2] };

    if (isUpdate) {
        await interaction.editReply(payload);
    } else {
        const reply = await interaction.editReply(payload);
        searchCache.set(reply.id, { query, userFilterId });
        setTimeout(() => searchCache.delete(reply.id), 30 * 60 * 1000);
    }
}

client.once(Events.ClientReady, () => console.log(`Logged in as ${client.user.tag}!`));

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === "widget") {
            const subcommand = interaction.options.getSubcommand(false);
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const snapshotDb = readSnapshotDatabase();

            if (subcommand === "restore" || subcommand === "remove") {
                let choices = [];

                for (const [id, snap] of Object.entries(snapshotDb)) {
                    if (subcommand === "remove") {
                        const isOwner = interaction.user.id === config.ownerId;
                        const isCreator = snap.creatorId === interaction.user.id;

                        if (!isOwner && !isCreator) continue;
                    }

                    const name = `${snap.title || "Untitled"} (${id})`;
                    if (name.toLowerCase().includes(focusedValue) || id.toLowerCase().includes(focusedValue)) {
                        choices.push({ name: name, value: id });
                    }
                }

                await interaction.respond(choices.slice(0, 25)).catch(console.error);
            }
        }
        return;
    }

    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        const originalUser = interaction.message?.interactionMetadata?.user || interaction.message?.interaction?.user;

        if (originalUser && interaction.user.id !== originalUser.id) {
            const embed = new EmbedBuilder()
                .setColor(0x07070b)
                .setDescription(`This interaction belongs to **${originalUser.username}**. Run your own command, you pancake! Eehehheeheeehehehehehee`);
            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }
    }

    const db = readDatabase();
    const userId = interaction.user.id;

    const initUserData = () => {
        if (!db[userId]) {
            db[userId] = {
                username: interaction.user.username,
                currentView: "all_views",
                id: Object.keys(db).length,
                widget: { ...DEFAULT_WIDGET_DATA }
            };
        } else if (!db[userId].widget) {
            const oldData = { ...db[userId] };
            delete oldData.username;
            delete oldData.currentView;

            db[userId] = {
                username: db[userId].username || interaction.user.username,
                currentView: db[userId].currentView || "all_views",
                id: db[userId].id ?? Object.keys(db).length,
                widget: { ...DEFAULT_WIDGET_DATA, ...oldData }
            };
        }
    };

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "widget") {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === "setup") {
                const authorizeUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id ?? process.env.CLIENT_ID}&response_type=token&scope=${SCOPES.join("+")}`;

                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setTitle("Widget Setup")
                    .setDescription(`To set up your custom profile widget, please **authorize the application** using the button below.\n\nYou may close the window once you finish authorization.\n\n-# Note: The authorization screen requests permissions necessary for social layer identity components. This bot updates your profile using secure backend sync layers.`)

                const authorizeButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel("Authorize Widget")
                    .setURL(authorizeUrl);

                const row = new ActionRowBuilder().addComponents(authorizeButton);

                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }

            if (subcommand === "set") {
                await interaction.deferReply({});
                initUserData();

                let updated = false;
                OPTION_MAPPING.forEach(({ key }) => {
                    const value = interaction.options.get(key?.toLowerCase())?.value;
                    if (value !== undefined) {
                        db[userId].widget[key] = value;
                        updated = true;
                    }
                });

                db[userId].username = interaction.user.username;
                writeDatabase(db);

                try {
                    await syncDiscordWidget(userId, db[userId]);
                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription(updated
                            ? "Your profile widget has updated successfully."
                            : "Your profile widget has synced successfully.");
                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.error(error);
                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription(`Failed to sync widget data: ${error.message}`);
                    await interaction.editReply({ embeds: [embed] });
                }
            }

            if (subcommand === "reset") {
                await interaction.deferReply({});
                db[userId] = {
                    username: interaction.user.username,
                    currentView: "all_views",
                    id: db[userId].id ?? Object.keys(db).length,
                    widget: { ...DEFAULT_WIDGET_DATA }
                };
                writeDatabase(db);
                try {
                    await syncDiscordWidget(userId, db[userId]);
                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription("User widget reset to default successfully.");
                    return interaction.editReply({ embeds: [embed] });
                } catch (e) {
                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription(`Local fallback configured, upstream sync block issue: ${e.message}`);
                    return interaction.editReply({ embeds: [embed] });
                }
            }

            if (subcommand === "builder") {
                const isEphemeral = interaction.options.getBoolean("ephemeral") || false;
                await interaction.deferReply({ flags: isEphemeral ? ["Ephemeral"] : [] });
                initUserData();
                db[userId].currentView = "all_views";
                writeDatabase(db);

                const imgBuffer = await generateWidgetPreviewBuffer(db[userId]);
                const attachment = new AttachmentBuilder(imgBuffer, { name: "preview.png" });

                return interaction.editReply({
                    embeds: [generateBuilderEmbed(interaction.user.username)],
                    components: generateControlComponents(db[userId].currentView),
                    files: [attachment]
                });
            }

            if (subcommand === "create") {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                initUserData();

                const title = interaction.options.getString("title") || "Untitled Snapshot";
                const description = interaction.options.getString("description") || "No description provided.";

                const snapshotDb = readSnapshotDatabase();
                let snapshotId;

                do {
                    snapshotId = generateSnapshotId();
                } while (snapshotDb[snapshotId]);

                const widgetStateCopy = JSON.parse(JSON.stringify(db[userId]));

                snapshotDb[snapshotId] = {
                    creatorId: userId,
                    creatorName: interaction.user.username,
                    createdAt: Date.now(),
                    title: title,
                    description: description,
                    data: widgetStateCopy
                };

                writeSnapshotDatabase(snapshotDb);

                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`**Widget Snapshot Created!**\nYour current configuration has been saved.\n\n**Snapshot ID:** \`${snapshotId}\`\n**Title:** *${title}*\n\nYou or other users can load this using \`/widget snapshot restore id:${snapshotId}\`.\n\n-# If you ever want to delete this snapshot, use \`/widget snapshot remove id:${snapshotId}\`.`);

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === "restore") {
                await interaction.deferReply({});
                const snapshotId = interaction.options.getString("id");
                const snapshotDb = readSnapshotDatabase();

                const snapshot = snapshotDb[snapshotId];
                if (!snapshot) {
                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription(`Could not find a valid widget snapshot configuration matching the ID: \`${snapshotId}\``);
                    return interaction.editReply({ embeds: [embed] });
                }

                const previewData = {
                    currentView: "all_views",
                    username: snapshot.creatorName,
                    widget: { ...DEFAULT_WIDGET_DATA, ...(snapshot.data?.widget || {}) }
                };

                const imgBuffer = await generateWidgetPreviewBuffer(previewData);
                const attachment = new AttachmentBuilder(imgBuffer, { name: "preview.png" });

                const embed = generateBuilderEmbed(interaction.user.username)
                    .setTitle(`Restore Snapshot Preview: ${snapshot.title || "Untitled"}`)
                    .setDescription(`**Description:** ${snapshot.description || "None"}\n**Created By:** ${snapshot.creatorName || "Unknown User"}\n\nAre you sure you want to restore this configuration? This will overwrite your existing widget attributes.`);

                return interaction.editReply({
                    embeds: [embed],
                    components: generateRestoreControlComponents(snapshotId, "all_views"),
                    files: [attachment]
                });
            }

            if (subcommand === "search") {
                await interaction.deferReply({});
                const query = interaction.options.getString("query");
                const userFilter = interaction.options.getUser("user");
                const userFilterId = userFilter ? userFilter.id : null;

                await renderSearchPage(interaction, query, userFilterId, 0, false);
                return;
            }

            if (subcommand === "remove") {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                const snapshotId = interaction.options.getString("id");
                const snapshotDb = readSnapshotDatabase();

                const snapshot = snapshotDb[snapshotId];

                if (!snapshot) {
                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription(`Could not find a valid widget snapshot matching the ID provided.`);
                    return interaction.editReply({ embeds: [embed] });
                }

                if (interaction.user.id !== config.ownerId && snapshot.creatorId !== interaction.user.id) {
                    const embed = new EmbedBuilder()
                        .setColor(0xED4245)
                        .setDescription(`You do not have permission to delete this snapshot.`);
                    return interaction.editReply({ embeds: [embed] });
                }

                delete snapshotDb[snapshotId];
                writeSnapshotDatabase(snapshotDb);

                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`**Snapshot Removed Successfully!**\nThe snapshot **${snapshot.title || "Untitled"}** (\`${snapshotId}\`) has been permanently deleted from the database.`);
                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === "gallery") {
                await interaction.deferReply();
                await renderGalleryPage(interaction, 0);
                return;
            }

            if (subcommand === "export") {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                initUserData();

                const exportData = JSON.stringify(db[userId]?.widget || {}, null, 2);
                const buffer = Buffer.from(exportData, "utf-8");
                const attachment = new AttachmentBuilder(buffer, { name: "widget-export.json" });

                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription("Here is your current widget configuration file. You can share this with others so they can import your layout!");

                return interaction.editReply({ embeds: [embed], files: [attachment] });
            }

            if (subcommand === "import") {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                initUserData();

                const file = interaction.options.getAttachment("file");

                if (!file.name.endsWith(".json")) {
                    const embed = new EmbedBuilder().setColor(0xED4245).setDescription("Please upload a valid JSON file.");
                    return interaction.editReply({ embeds: [embed] });
                }

                try {
                    const response = await fetch(file.url);
                    const importedData = await response.json();

                    const sourceWidget = importedData || {};

                    OPTION_MAPPING.forEach(({ key }) => {
                        if (sourceWidget[key] !== undefined) {
                            db[userId].widget[key] = sourceWidget[key];
                        }
                    });

                    db[userId].username = interaction.user.username;
                    writeDatabase(db);

                    await syncDiscordWidget(userId, db[userId]);

                    const embed = new EmbedBuilder()
                        .setColor(0x07070b)
                        .setDescription("Widget configuration successfully imported and synced to your profile!");
                    return interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error("Import error:", error);
                    const embed = new EmbedBuilder().setColor(0xED4245).setDescription("Failed to parse or apply the provided JSON file. Ensure it is a valid export.");
                    return interaction.editReply({ embeds: [embed] });
                }
            }
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "wb_select_category") {
        await interaction.deferUpdate();
        initUserData();

        const selection = interaction.values[0];
        db[userId].currentView = selection;
        writeDatabase(db);

        const imgBuffer = await generateWidgetPreviewBuffer(db[userId]);
        const attachment = new AttachmentBuilder(imgBuffer, { name: "preview.png" });

        return interaction.editReply({
            embeds: [generateBuilderEmbed(interaction.user.username)],
            components: generateControlComponents(selection),
            files: [attachment]
        });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("wb_snapshot_select_category_")) {
        await interaction.deferUpdate();

        const snapshotId = interaction.customId.replace("wb_snapshot_select_category_", "");
        const snapshotDb = readSnapshotDatabase();
        const snapshot = snapshotDb[snapshotId];

        if (!snapshot) {
            const embed = new EmbedBuilder()
                .setColor(0x07070b)
                .setDescription(`That snapshot no longer exists.`);
            return interaction.editReply({ embeds: [embed], components: [], files: [] });
        }

        const selection = interaction.values[0];
        const previewData = {
            currentView: selection,
            username: snapshot.creatorName,
            widget: { ...DEFAULT_WIDGET_DATA, ...(snapshot.data?.widget || {}) }
        };

        const imgBuffer = await generateWidgetPreviewBuffer(previewData);
        const attachment = new AttachmentBuilder(imgBuffer, { name: "preview.png" });

        const embed = generateBuilderEmbed(interaction.user.username)
            .setTitle(`Restore Snapshot Preview: ${snapshot.title || "Untitled"}`)
            .setDescription(`**Description:** ${snapshot.description || "None"}\n\nAre you sure you want to restore this snapshot to your widget?`);

        return interaction.editReply({
            embeds: [embed],
            components: generateRestoreControlComponents(snapshotId, selection),
            files: [attachment]
        });
    }

    if (interaction.isButton()) {
        initUserData();

        if (interaction.customId.startsWith("gal_prev_") || interaction.customId.startsWith("gal_next_")) {
            await interaction.deferUpdate();

            const isNext = interaction.customId.startsWith("gal_next_");
            const currentIndex = parseInt(interaction.customId.replace(isNext ? "gal_next_" : "gal_prev_", ""), 10);
            const newIndex = isNext ? currentIndex + 1 : currentIndex - 1;

            await renderGalleryPage(interaction, newIndex);
            return;
        }

        if (interaction.customId === "gal_close") {
            await interaction.deferUpdate();
            try {
                await interaction.deleteReply();
            } catch (err) {
                try {
                    const msg = await interaction.fetchReply();
                    await msg.delete();
                } catch (e) {
                    console.error("Failed to close gallery panel:", e);
                }
            }
            const embed = new EmbedBuilder().setColor(0x07070b).setDescription("Gallery panel closed.");
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }

        if (interaction.customId.startsWith("search_prev_") || interaction.customId.startsWith("search_next_")) {
            await interaction.deferUpdate();
            const cache = searchCache.get(interaction.message.id);
            if (!cache) {
                const embed = new EmbedBuilder().setColor(0xED4245).setDescription("Search session expired. Please run `/widget search` again.");
                return interaction.followUp({ embeds: [embed], ephemeral: true });
            }

            const isNext = interaction.customId.startsWith("search_next_");
            const currentIndex = parseInt(interaction.customId.replace(isNext ? "search_next_" : "search_prev_", ""), 10);
            const newIndex = isNext ? currentIndex + 1 : currentIndex - 1;

            await renderSearchPage(interaction, cache.query, cache.userFilterId, newIndex, true);
            return;
        }

        if (interaction.customId === "search_close") {
            await interaction.deferUpdate();
            searchCache.delete(interaction.message.id);
            try {
                await interaction.deleteReply();
            } catch (err) {
                try {
                    const msg = await interaction.fetchReply();
                    await msg.delete();
                } catch (e) {
                    console.error("Failed to close search panel:", e);
                }
            }
            const embed = new EmbedBuilder().setColor(0x07070b).setDescription("Search panel closed.");
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }

        if (interaction.customId === "wb_btn_sync") {
            await interaction.deferReply({ flags: ["Ephemeral"] });
            try {
                await syncDiscordWidget(userId, db[userId]);
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription("Saved and published user widget successfully.");
                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`User widget sync failed: ${e.message}`);
                return interaction.editReply({ embeds: [embed] });
            }
        }

        if (interaction.customId === "wb_btn_close") {
            await interaction.deferUpdate();
            try {
                await interaction.deleteReply();
            } catch (err) {
                try {
                    const msg = await interaction.fetchReply();
                    await msg.delete();
                } catch (e) {
                    console.error("Failed to delete reply:", e);
                }
            }
            const embed = new EmbedBuilder()
                .setColor(0x07070b)
                .setDescription("Widget builder closed.");
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }

        if (interaction.customId === "wb_btn_reset_init") {
            await interaction.deferUpdate();

            const confirmEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("Confirm Factory Reset")
                .setDescription("Are you sure you want to revert your widget back to the default widget? This action cannot be undone.");

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("wb_btn_reset_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("wb_btn_reset_confirm").setLabel("Confirm").setStyle(ButtonStyle.Danger)
            );

            return interaction.editReply({ embeds: [confirmEmbed], components: [actionRow], files: [] });
        }

        if (interaction.customId === "wb_btn_reset_confirm") {
            await interaction.deferUpdate();
            db[userId] = {
                username: interaction.user.username,
                currentView: "all_views",
                id: db[userId].id ?? Object.keys(db).length,
                widget: { ...DEFAULT_WIDGET_DATA }
            };
            writeDatabase(db);
            await syncDiscordWidget(userId, db[userId]).catch(() => { });

            try {
                await interaction.deleteReply();
            } catch (err) {
                try {
                    const msg = await interaction.fetchReply();
                    await msg.delete();
                } catch (e) {
                    console.error("Failed to delete reply:", e);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x07070b)
                .setDescription("Factory reset complete. Your widget was restored to defaults.");
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }

        if (interaction.customId === "wb_snapshot_cancel") {
            await interaction.deferUpdate();
            searchCache.delete(interaction.message.id);
            try {
                await interaction.deleteReply();
            } catch (err) {
                try {
                    const msg = await interaction.fetchReply();
                    await msg.delete();
                } catch (e) {
                    console.error("Failed to close snapshot restore panel:", e);
                }
            }
            const embed = new EmbedBuilder().setColor(0x07070b).setDescription("Snapshot restore canceled.");
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }

        if (interaction.customId === "wb_btn_reset_cancel") {
            await interaction.deferUpdate();
            db[userId].currentView = "all_views";
            writeDatabase(db);

            const imgBuffer = await generateWidgetPreviewBuffer(db[userId]);
            const attachment = new AttachmentBuilder(imgBuffer, { name: "preview.png" });

            return interaction.editReply({
                embeds: [generateBuilderEmbed(interaction.user.username)],
                components: generateControlComponents("all_views"),
                files: [attachment]
            });
        }

        if (interaction.customId.startsWith("wb_snapshot_confirm_")) {
            await interaction.deferUpdate();
            const targetSnapshotId = interaction.customId.replace("wb_snapshot_confirm_", "");
            const snapshotDb = readSnapshotDatabase();
            const snapshot = snapshotDb[targetSnapshotId];

            if (!snapshot) {
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`Failed to execute restoration phase: Snapshot widget ID \`${targetSnapshotId}\` vanished from backend arrays.`);
                return interaction.editReply({ embeds: [embed], components: [], files: [] });
            }

            db[userId] = {
                username: interaction.user.username,
                currentView: "all_views",
                id: db[userId].id ?? Object.keys(db).length,
                widget: { ...DEFAULT_WIDGET_DATA, ...(snapshot.data?.widget || {}) }
            };

            writeDatabase(db);

            try {
                await syncDiscordWidget(userId, db[userId]);

                try {
                    await interaction.deleteReply();
                } catch (err) {
                    try {
                        const msg = await interaction.fetchReply();
                        await msg.delete();
                    } catch (e) {
                        console.error("Failed to delete reply:", e);
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`Snapshot \`${targetSnapshotId}\` restored successfully.`);
                return interaction.followUp({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error(error);
                try {
                    await interaction.deleteReply();
                } catch (err) {
                    try {
                        const msg = await interaction.fetchReply();
                        await msg.delete();
                    } catch (e) {
                        console.error("Failed to delete reply:", e);
                    }
                }
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`Restored locally, but live sync failed: ${error.message}`);
                return interaction.followUp({ embeds: [embed], ephemeral: true });
            }
        }

        const partialMatch = interaction.customId.match(/^wb_snapshot_partial_([a-zA-Z0-9]{8})_(.+)$/);
        if (partialMatch) {
            await interaction.deferUpdate();
            const targetSnapshotId = partialMatch[1];
            const targetView = partialMatch[2];

            const snapshotDb = readSnapshotDatabase();
            const snapshot = snapshotDb[targetSnapshotId];

            if (!snapshot) {
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`Failed to execute restoration phase: Snapshot widget ID \`${targetSnapshotId}\` vanished from backend arrays.`);
                return interaction.editReply({ embeds: [embed], components: [], files: [] });
            }

            const snapshotWidget = snapshot.data?.widget || {};
            const keysToUpdate = CATEGORY_KEYS[targetView] || [];
            keysToUpdate.forEach(key => {
                if (snapshotWidget[key] !== undefined) {
                    db[userId].widget[key] = snapshotWidget[key];
                }
            });

            db[userId].username = interaction.user.username;
            db[userId].currentView = "all_views";
            writeDatabase(db);

            try {
                await syncDiscordWidget(userId, db[userId]);
                try {
                    await interaction.deleteReply();
                } catch (err) {
                    try {
                        const msg = await interaction.fetchReply();
                        await msg.delete();
                    } catch (e) { }
                }
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`Snapshot component restored successfully.`);
                return interaction.followUp({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error(error);
                try {
                    await interaction.deleteReply();
                } catch (err) {
                    try {
                        const msg = await interaction.fetchReply();
                        await msg.delete();
                    } catch (e) { }
                }
                const embed = new EmbedBuilder()
                    .setColor(0x07070b)
                    .setDescription(`Restored locally, but live sync failed: ${error.message}`);
                return interaction.followUp({ embeds: [embed], ephemeral: true });
            }
        }

        if (interaction.customId.startsWith("wb_btn_edit_")) {
            const category = interaction.customId.replace("wb_btn_edit_", "");
            const modal = new ModalBuilder().setCustomId(`modal_${category}`).setTitle("Edit Properties");
            const data = db[userId].widget;

            if (category === "cat_top_p1") {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topTitle").setLabel("Title').setValue(data.topTitle || '").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topImage").setLabel("Banner Asset URL').setValue(data.topImage || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topSub1").setLabel("Subtitle 1').setValue(data.topSub1 || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topSub1Icon").setLabel("Subtitle 1 Icon URL').setValue(data.topSub1Icon || '").setStyle(TextInputStyle.Short).setRequired(false))
                );
            } else if (category === "cat_top_p2") {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topSub2").setLabel("Subtitle 2').setValue(data.topSub2 || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topSub2Icon").setLabel("Subtitle 2 Icon URL').setValue(data.topSub2Icon || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topSub3").setLabel("Subtitle 3').setValue(data.topSub3 || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("topSub3Icon").setLabel("Subtitle 3 Icon URL').setValue(data.topSub3Icon || '").setStyle(TextInputStyle.Short).setRequired(false))
                );
            } else if (category === "cat_bottom") {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("bottomTitle").setLabel("Title').setValue(data.bottomTitle || '").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("bottomDescription").setLabel("Description').setValue(data.bottomDescription || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("bottomProgress").setLabel("Progress Percentage (0-100)").setValue(String(data.bottomProgress)).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("bottomImage").setLabel("Image Icon URL').setValue(data.bottomImage || '").setStyle(TextInputStyle.Short).setRequired(false))
                );
            } else if (category === "cat_preview") {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("previewThumbnail").setLabel("Image Thumbnail URL').setValue(data.previewThumbnail || '").setStyle(TextInputStyle.Short).setRequired(false))
                );
            } else if (category === "cat_mini") {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("miniLabel").setLabel("Label').setValue(data.miniLabel || '").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("miniThumbnail").setLabel("Image Thumbnail URL').setValue(data.miniThumbnail || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("miniDescription").setLabel("Description').setValue(data.miniDescription || '").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("miniIcon").setLabel("Image Icon URL').setValue(data.miniIcon || '").setStyle(TextInputStyle.Short).setRequired(false))
                );
            } else if (category === "cat_activity") {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("activityLabel").setLabel("Label').setValue(data.activityLabel || '").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("activityDescription").setLabel("Description').setValue(data.activityDescription || '").setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("activityIcon").setLabel("Image Icon URL').setValue(data.activityIcon || '").setStyle(TextInputStyle.Short).setRequired(false)),
                );
            }

            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
        await interaction.deferUpdate();
        initUserData();

        const category = interaction.customId.replace("modal_", "");

        if (category === "cat_top_p1") {
            db[userId].widget.topTitle = interaction.fields.getTextInputValue("topTitle");
            db[userId].widget.topImage = interaction.fields.getTextInputValue("topImage");
            db[userId].widget.topSub1 = interaction.fields.getTextInputValue("topSub1");
            db[userId].widget.topSub1Icon = interaction.fields.getTextInputValue("topSub1Icon");
        } else if (category === "cat_top_p2") {
            db[userId].widget.topSub2 = interaction.fields.getTextInputValue("topSub2");
            db[userId].widget.topSub2Icon = interaction.fields.getTextInputValue("topSub2Icon");
            db[userId].widget.topSub3 = interaction.fields.getTextInputValue("topSub3");
            db[userId].widget.topSub3Icon = interaction.fields.getTextInputValue("topSub3Icon");
        } else if (category === "cat_bottom") {
            db[userId].widget.bottomTitle = interaction.fields.getTextInputValue("bottomTitle");
            db[userId].widget.bottomDescription = interaction.fields.getTextInputValue("bottomDescription");
            db[userId].widget.bottomImage = interaction.fields.getTextInputValue("bottomImage");

            let val = parseInt(interaction.fields.getTextInputValue("bottomProgress"), 10);
            if (isNaN(val)) val = 0;
            db[userId].widget.bottomProgress = Math.max(0, Math.min(100, val));
        } else if (category === "cat_preview") {
            db[userId].widget.previewThumbnail = interaction.fields.getTextInputValue("previewThumbnail");
        } else if (category === "cat_mini") {
            db[userId].widget.miniLabel = interaction.fields.getTextInputValue("miniLabel");
            db[userId].widget.miniThumbnail = interaction.fields.getTextInputValue("miniThumbnail");
            db[userId].widget.miniDescription = interaction.fields.getTextInputValue("miniDescription");
            db[userId].widget.miniIcon = interaction.fields.getTextInputValue("miniIcon");
        } else if (category === "cat_activity") {
            db[userId].widget.activityLabel = interaction.fields.getTextInputValue("activityLabel");
            db[userId].widget.activityDescription = interaction.fields.getTextInputValue("activityDescription");
            db[userId].widget.activityIcon = interaction.fields.getTextInputValue("activityIcon");
        }

        writeDatabase(db);
        await syncDiscordWidget(userId, db[userId]).catch(() => { });

        const imgBuffer = await generateWidgetPreviewBuffer(db[userId]);
        const attachment = new AttachmentBuilder(imgBuffer, { name: "preview.png" });

        return interaction.editReply({
            embeds: [generateBuilderEmbed(interaction.user.username)],
            components: generateControlComponents(db[userId].currentView),
            files: [attachment]
        });
    }
});

client.login(process.env.DISCORD_TOKEN);