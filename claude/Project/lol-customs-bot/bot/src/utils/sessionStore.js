const { SESSION_STATUS, SESSION_TYPE } = require('../../../shared/src/types');
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs');
const path = require('path');

const DATA_DIR      = path.join(__dirname, '../../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const NOSHOW_FILE   = path.join(DATA_DIR, 'noshow.json');

// ── 파일 영속화 ──────────────────────────────────────────

function _ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _saveSessions() {
  _ensureDir();
  const obj = {};
  for (const [id, s] of sessions) {
    obj[id] = { ...s, blocked: [...s.blocked] };
  }
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2));
}

function _loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    for (const [id, s] of Object.entries(obj)) {
      s.blocked = new Set(s.blocked ?? []);
      sessions.set(id, s);
    }
    console.log(`[세션 복원] ${sessions.size}개 로드됨`);
  } catch (e) {
    console.error('[세션 복원 실패]', e.message);
  }
}

function _saveNoshow() {
  _ensureDir();
  fs.writeFileSync(NOSHOW_FILE, JSON.stringify(Object.fromEntries(noshoCounts), null, 2));
}

function _loadNoshow() {
  try {
    if (!fs.existsSync(NOSHOW_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(NOSHOW_FILE, 'utf8'));
    for (const [id, count] of Object.entries(obj)) {
      noshoCounts.set(id, count);
    }
  } catch (e) {
    console.error('[노쇼 복원 실패]', e.message);
  }
}

// ── 저장소 초기화 ─────────────────────────────────────────

const sessions    = new Map();
const noshoCounts = new Map();

_loadSessions();
_loadNoshow();

// ── CRUD ──────────────────────────────────────────────────

function createSession(hostId, hostName, type = SESSION_TYPE.CUSTOM) {
  const id = uuidv4();
  const session = {
    id,
    type,
    hostId,
    hostName,
    mode: null,
    partySize: null,
    partyGameMode: null,
    status: SESSION_STATUS.RECRUITING,
    participants: [],
    messageId: null,
    channelId: null,
    createdAt: Date.now(),
    joinLog: [],
    blocked: new Set(),
  };
  sessions.set(id, session);
  _saveSessions();
  return session;
}

function getSession(id) {
  return sessions.get(id) ?? null;
}

function setMode(id, mode) {
  const s = sessions.get(id);
  if (!s) return null;
  s.mode = mode;
  _saveSessions();
  return s;
}

function addParticipant(id, discordId, discordName) {
  const s = sessions.get(id);
  if (!s) return null;
  if (s.participants.find(p => p.discordId === discordId)) return s;
  s.participants.push({
    discordId, discordName,
    riotNick: null, tier: null, position: null,
    joinOrder: s.participants.length + 1,
  });
  _pushLog(s, 'join', discordId, discordName);
  _saveSessions();
  return s;
}

function removeParticipant(id, discordId) {
  const s = sessions.get(id);
  if (!s) return null;
  const p = s.participants.find(p => p.discordId === discordId);
  if (p) _pushLog(s, 'leave', discordId, p.discordName);
  s.participants = s.participants.filter(p => p.discordId !== discordId);
  s.participants.forEach((p, i) => { p.joinOrder = i + 1; });
  _saveSessions();
  return s;
}

function _pushLog(session, action, discordId, discordName) {
  session.joinLog.unshift({ action, discordId, discordName, at: Date.now() });
  if (session.joinLog.length > 3) session.joinLog.length = 3;
}

function blockUser(id, discordId) {
  const s = sessions.get(id);
  if (!s) return null;
  s.blocked.add(discordId);
  _saveSessions();
  return s;
}

function unblockUser(id, discordId) {
  const s = sessions.get(id);
  if (!s) return null;
  s.blocked.delete(discordId);
  _saveSessions();
  return s;
}

function isBlocked(id, discordId) {
  const s = sessions.get(id);
  return s ? s.blocked.has(discordId) : false;
}

function setPartySize(id, size) {
  const s = sessions.get(id);
  if (!s) return null;
  s.partySize = Number(size);
  _saveSessions();
  return s;
}

function setPartyGameMode(id, mode) {
  const s = sessions.get(id);
  if (!s) return null;
  s.partyGameMode = mode;
  _saveSessions();
  return s;
}

function setDone(id) {
  const s = sessions.get(id);
  if (!s) return null;
  s.status = SESSION_STATUS.DONE;
  _saveSessions();
  return s;
}

function updateParticipantTier(id, discordId, tier) {
  const s = sessions.get(id);
  if (!s) return null;
  const p = s.participants.find(p => p.discordId === discordId);
  if (p) { p.tier = tier; _saveSessions(); }
  return s;
}

function deleteSession(id) {
  sessions.delete(id);
  _saveSessions();
}

// 노쇼
function addNoshow(discordId) {
  noshoCounts.set(discordId, (noshoCounts.get(discordId) ?? 0) + 1);
  _saveNoshow();
}

function getNoshowCount(discordId) {
  return noshoCounts.get(discordId) ?? 0;
}

// 디버그 전용
function getAllSessions()      { return [...sessions.values()]; }
function resetNoshowCount(id) { noshoCounts.delete(id); _saveNoshow(); }
function getAllNoshowCounts()  { return Object.fromEntries(noshoCounts); }

module.exports = {
  createSession, getSession,
  setMode, setPartySize, setPartyGameMode,
  addParticipant, removeParticipant, updateParticipantTier,
  setDone, deleteSession,
  blockUser, unblockUser, isBlocked,
  addNoshow, getNoshowCount,
  getAllSessions, resetNoshowCount, getAllNoshowCounts,
};
