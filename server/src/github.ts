import dotenv from 'dotenv';

dotenv.config();

export interface GitHubConfig {
  token: string | null;
  repo: string | null;
  isConfigured: boolean;
}

export function getGitHubConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN?.trim() || null;
  const repo = process.env.GITHUB_REPO?.trim() || null;
  const isConfigured = Boolean(
    token && 
    repo && 
    token !== 'your_github_token_here' && 
    repo !== 'owner/repo' &&
    repo.includes('/')
  );

  return { token, repo, isConfigured };
}

export interface CreateIssueParams {
  task: string;
  decisionText: string;
  sourceQuote: string;
  meetingTitle: string;
  meetingDate: string;
  owner: string;
  deadline: string | null;
}

export interface CreateIssueResult {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  error?: string;
}

/**
 * Creates a GitHub issue for an ActionItem.
 * Returns the issue URL and issue number.
 */
export async function createGitHubIssue(params: CreateIssueParams): Promise<CreateIssueResult> {
  const { token, repo, isConfigured } = getGitHubConfig();

  if (!isConfigured || !token || !repo) {
    return {
      success: false,
      error: 'GitHub integration not configured in server/.env'
    };
  }

  const issueTitle = params.task.trim();
  const ownerLabel = params.owner ? params.owner.replace(/[^\w\s-]/g, '').trim() : 'Unassigned';
  const labels = ['orbit', ownerLabel].filter(Boolean);

  const issueBody = [
    `### 🛰️ ORBIT Action Item`,
    ``,
    `> **${params.decisionText}**`,
    ``,
    `**Source Quote:**`,
    `> "${params.sourceQuote}"`,
    ``,
    `| Field | Value |`,
    `| :--- | :--- |`,
    `| **Meeting** | ${params.meetingTitle} (${params.meetingDate}) |`,
    `| **Assignee** | ${params.owner} |`,
    `| **Deadline** | ${params.deadline || 'None specified'} |`,
    ``,
    `---`,
    `*Created by ORBIT // Institutional Memory Engine*`
  ].join('\n');

  try {
    const url = `https://api.github.com/repos/${repo}/issues`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ORBIT-App'
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels
      })
    });

    if (!response.ok) {
      let errText = `GitHub API Error: ${response.status} ${response.statusText}`;
      try {
        const errJson: any = await response.json();
        if (errJson && errJson.message) errText += ` - ${errJson.message}`;
      } catch {
        // use default status
      }
      return { success: false, error: errText };
    }

    const data: any = await response.json();
    return {
      success: true,
      issueUrl: data.html_url,
      issueNumber: data.number
    };

  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network failure connecting to GitHub API'
    };
  }
}

/**
 * Posts a reminder comment on an existing GitHub issue.
 */
export async function postGitHubComment(
  issueNumber: number,
  commentBody: string
): Promise<{ success: boolean; commentUrl?: string; error?: string }> {
  const { token, repo, isConfigured } = getGitHubConfig();

  if (!isConfigured || !token || !repo) {
    return { success: false, error: 'GitHub integration not configured' };
  }

  try {
    const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ORBIT-App'
      },
      body: JSON.stringify({ body: commentBody })
    });

    if (!response.ok) {
      let errText = `GitHub API Error: ${response.status}`;
      try {
        const errJson: any = await response.json();
        if (errJson && errJson.message) errText += ` - ${errJson.message}`;
      } catch {}
      return { success: false, error: errText };
    }

    const data: any = await response.json();
    return { success: true, commentUrl: data.html_url };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to post reminder comment' };
  }
}
