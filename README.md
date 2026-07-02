# Snapshot: Discord Widget Builder Bot

## Setup

1. Log into the [Discord Developer Portal](https://discord.com/developers/applications)
2. Run the following commands in the browser's DevTools console
<details>
    <summary>
        Click to expand
    </summary>

```js
let wpRequire = webpackChunkdiscord_developers.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_developers.pop();

let ApexStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.createOverride).exports.A;
let UserStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getCurrentUser).exports.A;
let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.flushWaitQueue).exports.A;
let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;
let globalCopy = navigator.userAgent.includes("Firefox") ? navigator.clipboard.writeText.bind(navigator.clipboard) : copy
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const SCOPES = ["sdk.social_layer_presence"];
const userId = UserStore.getCurrentUser().id
console.log("[Widget Creator] Creating a new app... Please solve the captcha if prompted")
const appRes = await api.post({ url: "/applications", body: { name: "Snapshot", team_id: null } })
FluxDispatcher.dispatch({ type: "APPLICATION_CREATE_SUCCESS", application: appRes.body })
const appId = appRes.body.id

console.log("[Widget Creator] Enabling social sdk...")
await api.post({
    url: `/applications/${appId}/social-sdk/enable`, body: {
        "name": "Snapshot LLC.",
        "business_email": "snapshot@gmail.com",
        "game_or_studio_name": "a",
        "game_or_studio_url": "",
        "email_updates_consent": false,
        "country_or_region": "United States",
        "title_role": "Other",
        "target_platforms": [],
        "form_type": "Dev Solutions",
        "sfdc_leadsource": "Dev Portal",
        "utm_campaign": "SDK Enable Form"
    }
})

console.log("[Widget Creator] Creating a new widget...");
const configRes = await api.post({
    url: `/applications/${appId}/widget-configs`, body: {
        display_name: "Snapshot"
    }
});
const configId = configRes.body.config_id;
await api.patch({ url: `/applications/${appId}/widget-configs/${configId}`, body: { "surfaces": { "widget_bottom": { "layout": "widget_bottom_progress", "components": { "progress": { "fields": { "current": { "value_type": "data", "presentation_type": "number", "value": "bottomProgress" } } }, "objective": { "fields": { "description": { "value_type": "data", "presentation_type": "text", "value": "bottomDescription" }, "image": { "value_type": "data", "presentation_type": "image", "value": "bottomImage" }, "name": { "value_type": "data", "presentation_type": "text", "value": "bottomTitle" } } } } }, "mini_profile": { "layout": "mini_profile_contained_stat", "components": { "stat": { "fields": { "text": { "value_type": "data", "presentation_type": "text", "value": "miniDescription" }, "icon": { "value_type": "data", "presentation_type": "image", "value": "miniIcon" }, "label": { "value_type": "data", "presentation_type": "text", "value": "miniLabel" } } }, "contained_image": { "fields": { "image": { "value_type": "data", "presentation_type": "image", "value": "miniThumbnail" } } } } }, "widget_top": { "layout": "widget_top_hero", "components": { "title": { "fields": { "text": { "value_type": "data", "presentation_type": "text", "value": "topTitle" } } }, "subtitle_1": { "fields": { "text": { "value_type": "data", "presentation_type": "text", "value": "topSub1" }, "icon": { "value_type": "data", "presentation_type": "image", "value": "topSub1Icon" } } }, "subtitle_3": { "fields": { "text": { "value_type": "data", "presentation_type": "text", "value": "topSub3" }, "icon": { "presentation_type": "image", "value_type": "data", "value": "topSub3Icon" } } }, "hero_image": { "fields": { "image": { "value_type": "data", "presentation_type": "image", "value": "topImage" } } }, "subtitle_2": { "fields": { "text": { "value_type": "data", "presentation_type": "text", "value": "topSub2" }, "icon": { "value_type": "data", "presentation_type": "image", "value": "topSub2Icon" } } } } }, "add_widget_preview": { "layout": "add_widget_preview_contained", "components": { "contained_image": { "fields": { "image": { "value_type": "data", "presentation_type": "image", "value": "previewThumbnail" } } } } }, "activity_accessory": { "layout": "activity_accessory_stat", "components": { "stat": { "fields": { "text": { "value_type": "data", "presentation_type": "text", "value": "activityDescription" }, "icon": { "value_type": "data", "presentation_type": "image", "value": "activityIcon" }, "label": { "value_type": "data", "presentation_type": "text", "value": "activityLabel" } } } } } } } });
await api.post({ url: `/applications/${appId}/widget-configs/${configId}/publish` })

console.log("[Widget Creator] Adding the widget to profile...")
await api.patch({ url: `/applications/${appId}`, body: { redirect_uris: ["https://discord.com"] } })
await api.post({ url: `/oauth2/authorize?client_id=${appId}&response_type=token&scope=sdk.social_layer_presence`, body: { authorize: true } })
const profileRes = await api.get({ url: `/users/${userId}/profile` })
const existingWidgets = profileRes.body.widgets
existingWidgets.unshift({ "data": { "type": "application", "application_id": appId } })
await api.put({ url: `/users/@me/widgets`, body: { "widgets": existingWidgets } }).catch(e => {
    console.warn("[Widget Creator] Failed to add widget to profile. You may have to do it manually later.");
})
console.log("[Widget Creator] If it did not add to your profile, you may have to do it manually later.");

console.log("[Widget Creator] Getting the bot's token... Please enter your 2FA if prompted")
const botTokenRes = await api.post({ url: `/applications/${appId}/bot/reset` })
const botToken = botTokenRes.body.token;

let cmd;
if (navigator.userAgentData?.platform === "Windows" || navigator.userAgent.includes("Windows")) {
    cmd = `Invoke-RestMethod -Method PATCH -Headers @{"Content-Type"="application/json"; "Authorization"="Bot ${botToken}";"User-Agent"="DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)"} -Uri https://discord.com/api/v9/applications/${appId}/users/${userId}/identities/0/profile -Body '${JSON.stringify({ data: { dynamic: [] } })}'`;
} else {
    cmd = `curl -X PATCH "https://discord.com/api/v9/applications/${appId}/users/${userId}/identities/0/profile" -H "Content-Type: application/json" -H "Authorization: Bot ${botToken}" -H "User-Agent: DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)" -d '${JSON.stringify({ data: { dynamic: [] } })}'`;
}

try {
    globalCopy(cmd);
} catch(e) {}
console.warn("[Widget Creator] If the command failed to copy to clipboard, copy this command and run it in your terminal.");
console.info(cmd);

ApexStore.createOverride("2026-03-widget-config-editor", 1)
document.querySelector(`a[href="/developers/applications/${appId}"]`).click()
while (!document.querySelector(`a[href="/developers/applications/${appId}/widget"]`)) {
    await sleep(100)
}
document.querySelector(`a[href="/developers/applications/${appId}/widget"]`).click()
console.log("[Widget Creator] Afterwards, you can edit your widget on this page!")


console.info("YOUR BOT'S DISCORD TOKEN: ", botToken);
console.info("YOUR BOT'S CLIENT ID: ", appId);
console.info(`To install to your user: https://discord.com/oauth2/authorize?client_id=${appId}&permissions=274877991936&integration_type=1&scope=applications.commands `);
console.info(`To install to a server: https://discord.com/oauth2/authorize?client_id=${appId}&permissions=274877991936&integration_type=0&scope=bot+applications.commands`);
```
</details>

3. Run the command it gives you in your terminal (ex. PowerShell)

![command](https://github.com/ZackiBoiz/Snapshot/blob/main/example/command.png)

4. Insert your bot's token and client ID into a `.env` file.

![credentials](https://github.com/ZackiBoiz/Snapshot/blob/main/example/credentials.png)

```env
DISCORD_TOKEN="YOUR BOT'S DISCORD TOKEN"
CLIENT_ID="YOUR BOT'S CLIENT ID"
```

5. Insert your user ID into a `config.json` file. This is so you can delete any snapshot for moderation.

```json
{
    "ownerId": "YOUR DISCORD USER ID"
}
```

6. Install the bot to your user or invite the bot to a server with the link it gives you

![install](https://github.com/ZackiBoiz/Snapshot/blob/main/example/install.png)

7. Install packages

```sh
npm init -y
npm install
```

8. Deploy slash commands

```sh
node deploy.js
```

9. Run the bot

```sh
node index.js
```

## Using the Bot

1. Run `/widget setup` and follow the instructions.
2. Run `/widget manage builder` to create your widget. You may use the dropdown and buttons to enter your data.
3. Press `Save & Publish Changes` to update your user's widget.
4. All other commands are on the bot's slash commands list. Just search for them.