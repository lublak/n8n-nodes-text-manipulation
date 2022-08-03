const fs = require('fs/promises');

const repo = process.env.GITHUB_REPOSITORY;
const slash_index = repo.indexOf('/');
const owner = repo.substring(0, slash_index);
const repo_name = repo.substring(slash_index+1);

/**
 * replace ${{#name#}} in data with value
 * @param {string} data
 * @param {string} name
 * @param {string} value
 * @return {string}
 */
function fillReplace(data, name, value) {
  return data.replace(new RegExp('\\$\\{\\{#' + name + '#\\}\\}', 'g'), value);
}

/**
 * fill out the file
 * @param {string} file
 */
async function apply(file) {
  let data = (await fs.readFile(file)).toString();
  data = fillReplace(data, 'REPO_NAME', repo_name);
  data = fillReplace(data, 'REPO_OWNER', owner);
  data = fillReplace(data, 'REPO_FULLNAME', repo);
  fs.writeFile(file, data);
}

/**
 * moves a .template file
 * @param {string} file
 */
async function moveTemplate(file) {
  await fs.unlink(file).catch(() => {});
  await fs.rename(file + '.template', file);
}

async function init() {
  await moveTemplate('README.md');
  await moveTemplate('.github/ISSUE_TEMPLATE/bug_report.yml');
  await moveTemplate('.github/ISSUE_TEMPLATE/feature_request.yml');
  await apply('README.md');
  await apply('package.json');
  await apply('package-lock.json');
  await apply('LICENSE');
  await apply('.github/ISSUE_TEMPLATE/bug_report.yml');
  await apply('.github/ISSUE_TEMPLATE/feature_request.yml');
  await apply('nodes/README.md');
  await apply('credentials/README.md');
}

init();
