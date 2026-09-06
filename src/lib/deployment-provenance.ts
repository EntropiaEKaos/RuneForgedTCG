export const DEPLOYMENT_ENVIRONMENTS = ["ci", "preview", "alpha", "staging", "production"] as const;
export type DeploymentEnvironment = typeof DEPLOYMENT_ENVIRONMENTS[number];

export type DeploymentProvenance = {
  commitSha: string;
  commitShort: string;
  environment: DeploymentEnvironment;
};

type DeploymentEnvSource = {
  RUNEFORGE_DEPLOY_SHA?: string;
  RUNEFORGE_DEPLOY_ENV?: string;
};

export function readDeploymentProvenance(
  env: DeploymentEnvSource = process.env,
): DeploymentProvenance | null {
  const rawSha = env.RUNEFORGE_DEPLOY_SHA?.trim() || "";
  const commitSha = rawSha.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commitSha)) return null;

  const rawEnvironment = env.RUNEFORGE_DEPLOY_ENV?.trim().toLowerCase() || "";
  if (!DEPLOYMENT_ENVIRONMENTS.includes(rawEnvironment as DeploymentEnvironment)) return null;

  return {
    commitSha,
    commitShort: commitSha.slice(0, 12),
    environment: rawEnvironment as DeploymentEnvironment,
  };
}
