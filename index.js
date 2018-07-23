const Table = require('cli-table');
const env = require('node-env-file');
const fetch = require('node-fetch');

try {
  env(__dirname + '/.env');
} catch(e) {
  console.error('.env file with GitHub API key missing!');
}

const query = `
{
  user(login: "${process.env.LOGIN}") {
    pullRequests(last: 100, states: OPEN) {
      edges {
        node {
          repository{
            name
          }
          state
          resourcePath
          baseRefName
          headRefName
          reviews(last:10) {
            edges{
              node{
                state
              }
            }
          }
          commits(last: 1) {
            edges {
              node {
                commit {
                  status {
                    state
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`; 

fetch('https://api.github.com/graphql', {
  method: 'POST',
  body: JSON.stringify({query}),
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
  },
}).then(res => res.text())
  .then(parseResult) // {"data":{"repository":{"issues":{"totalCount":247}}}}
  .catch(error => console.error(error));

function parseResult(body) 
{
  const data = JSON.parse(body);
  const results = new Table({
    head: ['Repository', 'CI Build', 'State', 'Branch', 'Base', 'Link']
  });

  data.data.user.pullRequests.edges.forEach(edge => {
    const node = edge.node;
    
    let state = '';
    if (node.commits.edges[0].node.commit.status) {
      switch (node.commits.edges[0].node.commit.status.state) {
        case 'SUCCESS':
          state = 'OK';
        break;
        case 'FAILURE':
          state = 'ERR';
        break;
      }
    }

    let approval = '';
    node.reviews.edges.forEach(edge => {
      switch (node.reviews.edges[0].node.state) {
        case 'APPROVED':
        case 'DISMISSED':
          if (approval !== 'N') {
            approval = 'Y';
          }
        break;
        case 'CHANGES_REQUESTED':
          approval = 'N';
        break;
        case 'COMMENTED':
          approval = 'C';
        break;
      }
    });
    
    results.push([
      node.repository.name,
      state,
      approval,
      node.headRefName,
      node.baseRefName,
      'https://github.com' + node.resourcePath
    ]);
  });

  console.log(results.toString());
}
