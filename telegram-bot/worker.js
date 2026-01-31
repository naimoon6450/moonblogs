export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await request.json().catch(() => null);
    if (!update?.message?.text) return ok();

    const { chat, text } = update.message;
    if (String(chat.id) !== env.ALLOWED_CHAT_ID) return ok();

    const reply = (msg) => telegram(env, 'sendMessage', { chat_id: chat.id, text: msg });
    const rawText = text.trim();
    const lowerText = rawText.toLowerCase();

    if (lowerText === 'help' || lowerText === 'h') {
      return showHelp(env, reply);
    }

    if (lowerText === 'list' || lowerText === 'l') {
      return listToday(env, reply);
    }

    if (lowerText.startsWith('/add ')) {
      const habitName = rawText.slice(5).trim().toLowerCase().replace(/\s+/g, '-');
      return addHabit(env, reply, habitName);
    }

    if (lowerText.startsWith('/delete ')) {
      const habitName = rawText.slice(8).trim().toLowerCase().replace(/\s+/g, '-');
      return deleteHabit(env, reply, habitName);
    }

    if (lowerText.startsWith('/restore ')) {
      const habitName = rawText.slice(9).trim().toLowerCase().replace(/\s+/g, '-');
      return restoreHabit(env, reply, habitName);
    }

    const today = new Date().toISOString().slice(0, 10);
    const path = `data/habits/${today.slice(0, 4)}.yaml`;
    let file = await githubGet(env, path);
    let data = file ? parseYaml(file.content) : {};

    if (migrateShortcuts(data) && file) {
      await githubPut(env, path, serializeYaml(data), file.sha, 'Migrate shortcuts');
      file = await githubGet(env, path);
      data = parseYaml(file.content);
    }

    const shortcuts = data._shortcuts || {};
    const command = shortcuts[lowerText] || lowerText;
    return trackHabit(env, reply, command, data, file);
  },
};

async function trackHabit(env, reply, habit, preloadedData, preloadedFile) {
  const today = new Date().toISOString().slice(0, 10);
  const path = `data/habits/${today.slice(0, 4)}.yaml`;

  const file = preloadedFile;
  const data = preloadedData;

  if (!file) {
    return reply(`No habits file for ${today.slice(0, 4)}. Use /add ${habit} first.`);
  }

  const habits = getActiveHabits(data);

  if (!habits.includes(habit)) {
    return reply(`Unknown habit: "${habit}". Use /add ${habit} to create it.`);
  }

  if (data[habit]?.includes(today)) {
    return reply(`${habit} already tracked today`);
  }

  data[habit] = [...(data[habit] || []), today].sort();

  await githubPut(env, path, serializeYaml(data), file.sha, `Track ${habit} for ${today}`);
  return reply(`✓ ${habit}`);
}

async function listToday(env, reply) {
  const today = new Date().toISOString().slice(0, 10);
  const file = await githubGet(env, `data/habits/${today.slice(0, 4)}.yaml`);

  if (file === null) {
    return reply(`${today}\n\nNo habits yet. Use /add <habit> to create one.`);
  }

  const data = parseYaml(file.content);
  const habits = getActiveHabits(data);

  if (habits.length === 0) {
    return reply(`${today}\n\nNo habits yet. Use /add <habit> to create one.`);
  }

  const lines = habits.map((h) => `${data[h]?.includes(today) ? '✓' : '○'} ${h}`);
  return reply(`${today}\n\n${lines.join('\n')}`);
}

async function showHelp(env, reply) {
  const today = new Date().toISOString().slice(0, 10);
  const file = await githubGet(env, `data/habits/${today.slice(0, 4)}.yaml`);
  const data = file ? parseYaml(file.content) : {};
  const habits = getActiveHabits(data);
  const shortcuts = data._shortcuts || {};

  const habitCmds = habits.map((h) => {
    const shortcut = Object.entries(shortcuts).find(([, v]) => v === h)?.[0];
    return shortcut ? `${h} (${shortcut})` : h;
  }).join('\n');

  const cmds = [
    habitCmds || '(no habits yet)',
    '',
    '/add <name> - add habit',
    '/delete <name> - hide habit',
    '/restore <name> - restore hidden',
    'list (l)',
    'help (h)',
  ];
  return reply(`Commands:\n${cmds.join('\n')}`);
}

async function addHabit(env, reply, habit) {
  if (!habit || !/^[a-z][a-z0-9-]*$/.test(habit)) {
    return reply('Invalid habit name. Use lowercase letters, numbers, and hyphens.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const path = `data/habits/${today.slice(0, 4)}.yaml`;
  const file = await githubGet(env, path);

  const data = file ? parseYaml(file.content) : {};

  if (data[habit] !== undefined && !data._hidden?.includes(habit)) {
    return reply(`Habit "${habit}" already exists.`);
  }

  if (data._hidden?.includes(habit)) {
    data._hidden = data._hidden.filter((h) => h !== habit);
    await githubPut(env, path, serializeYaml(data), file?.sha, `Restore habit ${habit}`);
    const shortcut = Object.entries(data._shortcuts || {}).find(([, v]) => v === habit)?.[0];
    return reply(`✓ Restored "${habit}"${shortcut ? ` (${shortcut})` : ''}`);
  }

  data[habit] = [];
  const shortcut = generateShortcut(habit, data._shortcuts || {});
  if (shortcut) {
    data._shortcuts = { ...(data._shortcuts || {}), [shortcut]: habit };
  }
  await githubPut(env, path, serializeYaml(data), file?.sha, `Add habit ${habit}`);
  return reply(`✓ Added "${habit}"${shortcut ? ` (${shortcut})` : ''}`);
}

function generateShortcut(habit, existingShortcuts) {
  const usedKeys = new Set(Object.keys(existingShortcuts));
  const parts = habit.split('-');
  const firstLetter = parts[0][0];
  if (!usedKeys.has(firstLetter)) {
    return firstLetter;
  }
  for (const part of parts) {
    if (!usedKeys.has(part[0])) {
      return part[0];
    }
  }
  for (const char of habit.replace(/-/g, '')) {
    if (!usedKeys.has(char)) {
      return char;
    }
  }
  return null;
}

async function deleteHabit(env, reply, habit) {
  const today = new Date().toISOString().slice(0, 10);
  const path = `data/habits/${today.slice(0, 4)}.yaml`;
  const file = await githubGet(env, path);

  if (!file) {
    return reply('No habits file found.');
  }

  const data = parseYaml(file.content);
  const habits = getActiveHabits(data);

  if (!habits.includes(habit)) {
    return reply(`Habit "${habit}" not found.`);
  }

  data._hidden = [...(data._hidden || []), habit];
  await githubPut(env, path, serializeYaml(data), file.sha, `Hide habit ${habit}`);
  return reply(`✓ Hidden "${habit}" (use /restore ${habit} to bring it back)`);
}

async function restoreHabit(env, reply, habit) {
  const today = new Date().toISOString().slice(0, 10);
  const path = `data/habits/${today.slice(0, 4)}.yaml`;
  const file = await githubGet(env, path);

  if (!file) {
    return reply('No habits file found.');
  }

  const data = parseYaml(file.content);

  if (!data._hidden?.includes(habit)) {
    return reply(`Habit "${habit}" is not hidden.`);
  }

  data._hidden = data._hidden.filter((h) => h !== habit);
  await githubPut(env, path, serializeYaml(data), file.sha, `Restore habit ${habit}`);
  return reply(`✓ Restored "${habit}"`);
}

// --- GitHub API ---

async function githubGet(env, path) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`, {
    headers: githubHeaders(env),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data = await res.json();
  return { content: atob(data.content), sha: data.sha };
}

async function githubPut(env, path, content, sha, message) {
  const body = { message, content: btoa(content), branch: env.GITHUB_BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}`);
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'HabitBot',
  };
}

// --- Telegram API ---

async function telegram(env, method, body) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return ok();
}

function ok() {
  return new Response('OK');
}

// --- YAML ---

function parseYaml(content) {
  const data = {};
  let current = null;
  for (const line of content.split('\n')) {
    const key = line.match(/^([a-z_][a-z0-9_-]*):$/)?.[1];
    if (key) {
      current = key;
      if (current === '_shortcuts') {
        data[current] = {};
      } else {
        data[current] = [];
      }
    } else if (current === '_shortcuts') {
      const match = line.match(/^\s+([a-z]):\s+"?([a-z][a-z0-9-]*)"?$/);
      if (match) {
        data[current][match[1]] = match[2];
      }
    } else {
      const date = line.match(/^\s+-\s+"?(\d{4}-\d{2}-\d{2})"?$/)?.[1];
      const str = line.match(/^\s+-\s+"?([a-z][a-z0-9-]*)"?$/)?.[1];
      if (date && current) {
        data[current].push(date);
      } else if (str && current === '_hidden') {
        data[current].push(str);
      }
    }
  }
  return data;
}

function serializeYaml(data) {
  const lines = [];
  const hidden = data._hidden || [];
  const shortcuts = data._shortcuts || {};

  if (hidden.length > 0) {
    lines.push('_hidden:');
    hidden.forEach((h) => lines.push(`  - "${h}"`));
    lines.push('');
  }

  if (Object.keys(shortcuts).length > 0) {
    lines.push('_shortcuts:');
    Object.entries(shortcuts).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
      lines.push(`  ${k}: "${v}"`);
    });
    lines.push('');
  }

  const habits = Object.keys(data).filter((k) => k !== '_hidden' && k !== '_shortcuts').sort();
  for (const habit of habits) {
    lines.push(`${habit}:`);
    const dates = data[habit] || [];
    dates.forEach((d) => lines.push(`  - "${d}"`));
    if (dates.length > 0) lines.push('');
  }

  return lines.join('\n') + '\n';
}

function getActiveHabits(data) {
  const hidden = new Set(data._hidden || []);
  return Object.keys(data).filter((k) => k !== '_hidden' && k !== '_shortcuts' && !hidden.has(k)).sort();
}

function migrateShortcuts(data) {
  const habits = getActiveHabits(data);
  const shortcuts = data._shortcuts || {};
  const habitsWithShortcuts = new Set(Object.values(shortcuts));
  let changed = false;

  for (const habit of habits) {
    if (!habitsWithShortcuts.has(habit)) {
      const shortcut = generateShortcut(habit, shortcuts);
      if (shortcut) {
        shortcuts[shortcut] = habit;
        changed = true;
      }
    }
  }

  if (changed) {
    data._shortcuts = shortcuts;
  }
  return changed;
}
