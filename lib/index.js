/*
 * @Author: fei
 * @Date: 2018-08-23 17:50:31
 * @Last Modified by: atever
 * @Last Modified time: 2019-05-21 15:40:00
 */
'use strict';

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const insquirer = require('inquirer');
const simpleGit = require('simple-git/promise');

async function _getCurrentBranchAndStatus(dir) {
    const statusSummary = await simpleGit(dir).status();
    return {
        branch: statusSummary.current,
        changed: statusSummary.files.length > 0 ? true : false
    };
}

async function _stashCurrentChange(dir) {
    await simpleGit(dir).stash();
    return;
}

async function _popCurrentStash(dir) {
    await simpleGit(dir).stash(['pop']);
    return;
}

async function _updatePackageVersion(dir, mode) {
    if (mode === 'master') {
        const pkgPath = path.resolve(dir, 'package.json');
        const pkg = require(pkgPath);
        const previousVersion = pkg.version;
        let splitVersion = previousVersion.split('.');
        splitVersion[2] = Number(splitVersion[2]) + 1;
        const currentVersion = splitVersion.join('.');
        pkg.version = currentVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        return [previousVersion, currentVersion];
    } else {
        const pkgPath = path.resolve(dir, 'package.json');
        const pkg = require(pkgPath);
        const previousVersion = pkg.version;
        let splitVersion = previousVersion.split('.');
        splitVersion[1] = Number(splitVersion[1]) + 1;
        splitVersion[2] = 0;
        const currentVersion = splitVersion.join('.');
        pkg.version = currentVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        return [previousVersion, currentVersion];
    }
}

async function _choreVersionCommit(dir, version) {
    const git = simpleGit(dir);
    await git.add('./package.json');
    await git.commit(`chore(package.json): bump version to ${version}`);
}

async function resolveFeat(dir) {
    const remote = 'origin';
    const developBranch = 'develop';
    const remotDevelopBranch = 'remotes/origin/develop'
    const masterBranch = 'master';
    let previousVersion, currentVersion;

    console.log(chalk.green('>> 开始'));

    // 处理当前分支代码有修改的情况 git stash
    const currentStatus = await _getCurrentBranchAndStatus(dir);
    if (currentStatus.changed) {
        console.log(chalk.green(`>> 当前分支 ${currentStatus.branch} 存在代码修改，进行 git stash ......`));
        await _stashCurrentChange(dir);
    }

    const git = simpleGit(dir);
    const gitBranch = await git.branch();
    if(gitBranch.branches[remotDevelopBranch]) {
        // develop 分支拉取代码 --> 升级版本号 --> 推送到远程 develop 分支
        console.log(chalk.green(`>> 切换分支到: ${developBranch}`));
        await git.checkout(developBranch);

        console.log(chalk.green(`>> 拉取远程分支: git pull ${remote} ${developBranch}`));
        await git.pull(remote, developBranch);

        [previousVersion, currentVersion] = await _updatePackageVersion(dir, 'develop');
        console.log(chalk.green(`>> 更新版本号，旧版本号: ${previousVersion}，新版本号: ${currentVersion}`));

        console.log(chalk.green(`>> 提交版本更新 commit: chore(package.json): bump version to: ${currentVersion}`));
        await _choreVersionCommit(dir, currentVersion);

        console.log(chalk.green(`>> 推送到远程分支: git push ${remote} ${developBranch}`));
        await git.push(remote, developBranch);
    
        // master 分支合并 develop 分支 --> 打 tag --> 推送到远程分支
        console.log(chalk.green(`>> 切换分支到: ${masterBranch}`));
        await git.checkout(masterBranch);

        console.log(chalk.green(`>> 合并 ${developBranch}`));
        await git.mergeFromTo(developBranch, masterBranch);
    } else {
        [previousVersion, currentVersion] = await _updatePackageVersion(dir, 'notExistDevelop');
        console.log(chalk.green(`>> 更新版本号，旧版本号: ${previousVersion}，新版本号: ${currentVersion}`));
    
        console.log(chalk.green(`>> 提交版本更新 commit: chore(package.json): bump version to: ${currentVersion}`));
        await _choreVersionCommit(dir, currentVersion);
    }

    console.log(chalk.green(`>> tag: ${currentVersion}`));
    const answer = await insquirer.prompt([{
        type: 'input',
        name: 'tagMessage',
        message: 'tag message: '
    }]);
    await git.addAnnotatedTag(currentVersion, answer.tagMessage);

    console.log(chalk.green(`>> 推送到远程分支: git push ${remote} ${masterBranch} --tags`));
    await git .push(remote, masterBranch, { '--tags': true });

    // 回复当前分支修改的代码 git stash pop
    if (currentStatus.changed) {
        console.log(chalk.green('>> 恢复原分支修改的代码，进行 git stash pop ......'));
        await git.checkout(currentStatus.branch);
        await _popCurrentStash(dir);
    }
}

async function resolveFix(dir) {
    const remote = 'origin';
    const developBranch = 'develop';
    const remotDevelopBranch = 'remotes/origin/develop'
    const masterBranch = 'master';

    console.log(chalk.green('>> 开始'));

    // 处理当前分支代码有修改的情况 git stash
    const currentStatus = await _getCurrentBranchAndStatus(dir);
    if (currentStatus.changed) {
        console.log(chalk.green(`>> 当前分支 ${currentStatus.branch} 存在代码修改，进行 git stash ......`));
        await _stashCurrentChange(dir);
    }

    const git = simpleGit(dir);

    // master 分支拉取代码 --> 升级版本号 --> 打 tag --> 推送到远程 master 分支
    console.log(chalk.green(`>> 切换分支到: ${masterBranch}`));
    await git.checkout(masterBranch);

    console.log(chalk.green(`>> 拉取远程分支: git pull ${remote} ${masterBranch}`));
    await git.pull(remote, masterBranch);

    const [previousVersion, currentVersion] = await _updatePackageVersion(dir, 'master');
    console.log(chalk.green(`>> 更新版本号，旧版本号: ${previousVersion}，新版本号: ${currentVersion}`));

    console.log(chalk.green(`>> 提交版本更新 commit: chore(package.json): bump version to: ${currentVersion}`));
    await _choreVersionCommit(dir, currentVersion);

    console.log(chalk.green(`>> tag: ${currentVersion}`));
    const answer = await insquirer.prompt([{
        type: 'input',
        name: 'tagMessage',
        message: 'tag message: '
    }]);
    await git.addAnnotatedTag(currentVersion, answer.tagMessage);

    console.log(chalk.green(`>> 推送到远程分支: git push ${remote} ${masterBranch} --tags`));
    await git.push(remote, masterBranch, { '--tags': true });

    const gitBranch = await git.branch();
    if(gitBranch.branches[remotDevelopBranch]) {
        // develop 分支合并 master 分支 --> 推送到远程分支
        console.log(chalk.green(`>> 切换分支到: ${developBranch}`));
        await git.checkout(developBranch);

        console.log(chalk.green(`>> 合并 ${masterBranch}`));
        await git.mergeFromTo(masterBranch, developBranch);

        console.log(chalk.green(`>> 推送到远程分支: git push ${remote} ${developBranch}`));
        await git.push(remote, developBranch);
    }

    // 回复当前分支修改的代码 git stash pop
    if (currentStatus.changed) {
        console.log(chalk.green('>> 恢复原分支修改的代码，进行 git stash pop ......'));
        await git.checkout(currentStatus.branch);
        await _popCurrentStash(dir);
    }
}

module.exports = {
    resolveFeat,
    resolveFix
}
