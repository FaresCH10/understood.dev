// Keep the launcher and every child process on the same configuration.
// A project-owned database avoids a machine-wide standalone MongoDB on 27017.
export function applyDevDefaults(env) {
  env.MONGODB_URI ??= 'mongodb://127.0.0.1:27018/understood?replicaSet=rs0';
  env.PORT ??= '4000';
  env.APP_URL ??= 'http://localhost:5173';
  env.PROCESS_ROLE ??= 'both';
}

export function replicaSetError(error, port) {
  if (error?.code === 76 || error?.codeName === 'NoReplicationEnabled') {
    return new Error(
      `MongoDB on port ${port} is running without replication enabled. ` +
      'Understood requires a replica set for transactions. ' +
      'Point MONGODB_URI in apps/api/.env at a replica set, or remove that setting ' +
      'to use the project-owned development MongoDB on port 27018. ' +
      'The existing MongoDB service has not been changed.',
      { cause: error },
    );
  }
  return error;
}
