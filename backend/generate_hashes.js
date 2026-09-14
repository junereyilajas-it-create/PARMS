import bcrypt from 'bcryptjs';

async function run() {
  const users = [
    'junerey', 'randrei', 'jovan', 'raymark', 'ating', 'ianjade',
    'carla', 'lloyd', 'jaymark', 'ryan', 'prince', 'joken', 'joshua', 'riel', 'janrel'
  ];
  for (const user of users) {
    const hash = await bcrypt.hash(`${user}123`, 10);
    console.log(`'${user}': '${hash}',`);
  }
}
run();
