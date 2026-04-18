module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[봇 준비완료] ${client.user.tag} 로그인 성공`);
  },
};
