// ============================================================
// Teams Routes — Team management for Team/Enterprise plans
// ============================================================

const router = require('express').Router();
const { requireAuth, requirePlan } = require('../middleware/auth');
const db = require('../config/database');

// ─── CREATE TEAM ───
router.post('/', requireAuth, requirePlan('team', 'enterprise'), async (req, res) => {
  const { name } = req.body;
  const [team] = await db('teams').insert({
    name, owner_id: req.user.id, plan: req.user.plan,
    max_members: req.user.plan === 'enterprise' ? 999 : 5
  }).returning('*');
  
  await db('team_members').insert({ team_id: team.id, user_id: req.user.id, role: 'admin' });
  res.status(201).json(team);
});

// ─── ADD MEMBER ───
router.post('/:teamId/members', requireAuth, async (req, res) => {
  const team = await db('teams').where({ id: req.params.teamId, owner_id: req.user.id }).first();
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const memberCount = await db('team_members').where({ team_id: team.id }).count('id as count').first();
  if (memberCount.count >= team.max_members) {
    return res.status(400).json({ error: 'Team member limit reached' });
  }

  const { email } = req.body;
  const user = await db('users').where({ email: email.toLowerCase() }).first();
  if (!user) return res.status(404).json({ error: 'User not found. They must register first.' });

  await db('team_members').insert({ team_id: team.id, user_id: user.id, role: 'member' });
  await db('users').where({ id: user.id }).update({ plan: team.plan });
  
  res.json({ message: 'Member added' });
});

// ─── LIST MEMBERS ───
router.get('/:teamId/members', requireAuth, async (req, res) => {
  const members = await db('team_members')
    .join('users', 'team_members.user_id', 'users.id')
    .where({ team_id: req.params.teamId })
    .select('users.id', 'users.name', 'users.email', 'team_members.role', 'team_members.joined_at');
  res.json(members);
});

// ─── REMOVE MEMBER ───
router.delete('/:teamId/members/:userId', requireAuth, async (req, res) => {
  const team = await db('teams').where({ id: req.params.teamId, owner_id: req.user.id }).first();
  if (!team) return res.status(404).json({ error: 'Team not found' });
  
  await db('team_members').where({ team_id: team.id, user_id: req.params.userId }).del();
  await db('users').where({ id: req.params.userId }).update({ plan: 'free', credits: 0 });
  res.json({ message: 'Member removed' });
});

module.exports = router;
