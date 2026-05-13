/**
 * client/src/utils/export.js
 * Export final scores to CSV
 */

export function exportScoresToCSV(leaderboard, gameTitle = 'TriviaNight') {
  const headers = ['Rank', 'Name', 'Team', 'Score', 'Streak', 'Badges'];
  const rows = leaderboard.map((p, i) => [
    i + 1,
    p.name,
    p.team_name || '',
    p.score,
    p.streak || 0,
    (p.badges || []).join('; '),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${gameTitle.replace(/\s+/g, '-')}-scores-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


/**
 * client/src/utils/qrcode.js
 * Generate a QR code data URL for the join page
 */

import QRCode from 'qrcode';

export async function generateJoinQR(gameCode, baseUrl = window.location.origin) {
  const url = `${baseUrl}/join?code=${gameCode}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: { dark: '#0d0d14', light: '#ffffff' },
    });
    return { dataUrl, url };
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
}


/**
 * client/src/utils/teamGenerator.js
 * Random team generator from a list of player names
 */

export function generateRandomTeams(playerNames, teamSize = 4) {
  const shuffled = [...playerNames].sort(() => Math.random() - 0.5);
  const teams = [];
  const teamNames = [
    'The Brainiacs', 'Quiz Whizzes', 'Trivia Force', 'The Know-It-Alls',
    'Team Rocket', 'The Nerds', 'Smarty Pants', 'The Geek Squad',
    'Brain Trust', 'The Einsteins', 'Question Masters', 'Fact Attack',
  ];

  for (let i = 0; i < shuffled.length; i += teamSize) {
    teams.push({
      name: teamNames[teams.length % teamNames.length],
      members: shuffled.slice(i, i + teamSize),
    });
  }
  return teams;
}
