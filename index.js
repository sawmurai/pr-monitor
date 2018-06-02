const GitHub = require('github-api');
const Table = require('cli-table');
const colors = require('colors');
const Q = require('q');
const env = require('node-env-file');

try {
  env(__dirname + '/.env');
} catch(e) {

}

// basic auth
const gh = new GitHub({
  token: process.env.API_KEY
});

if (process.argv.length < 3) {
  console.log("Usage: Show all PRs of organisation <organisation> opened by <username>. <username> is optional.")
  console.log("node index.js <organisation> <username>")
  process.exit();
}

const organisation = process.argv[2];
let username;

if (process.argv.length > 3) {
  username =  process.argv[3];
}

let repoDeferreds = [];
let results = new Table({
  head: ['Repository', 'CI Build', 'Branch', 'Base', 'Link']
});

const deferred = Q.defer();
gh.getOrganization(organisation).getRepos().then(function(repos) {
  const repositoryNames = [];

  repos.data.forEach(function(repo) {
    repositoryNames.push(repo.name);
  });

  deferred.resolve(repositoryNames);
}).catch(console.log);

deferred.promise.then(getPendingPullRequests);

function getPendingPullRequests(repositories) {
  repositories.forEach(function(repository) {
    const repo = gh.getRepo(organisation, repository);
    
    const repoDefered = Q.defer();
    repoDeferreds.push(repoDefered.promise);

    repo.listPullRequests().then(function(prList) {
      const prListDeferreds = [];

      prList.data.forEach(function(item) {
        if (item.user.login !== username) {
          return;
        }

        const prDeferred = Q.defer();    
        prListDeferreds.push(prDeferred.promise);

        repo.listStatuses(item.head.sha).then(function(result) {
          if (!result.data || !result.data[0]) {
            results.push([repository, '', item.head.ref, item.base.ref, item._links.html.href]);

            prDeferred.reject();
            return;
          }
          
          let state = result.data[0].state;
        
          if (state == 'success') {
            state = state.green;
          } else if (state == 'error' || state == 'failure') {
            state = state.red;
          } else {
            state = state.yellow;
          }

          results.push([repository, state, item.head.ref, item.base.ref, item._links.html.href]);
          prDeferred.resolve();
        })
        .catch(console.log);
      });

      Q.allSettled(prListDeferreds).then(function() {
        repoDefered.resolve();
      });
    }).catch(console.log);
  });

  Q.allSettled(repoDeferreds).then(function(promises) {
    console.log(results.toString());
  });
}