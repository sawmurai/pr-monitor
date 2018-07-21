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
          
          createdAt
          createdViaEmail
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
    head: ['Repository', 'CI Build', 'Branch', 'Base', 'Link']
  });

  data.data.user.pullRequests.edges.forEach(edge => {
    const node = edge.node;
    
    let state = '';
    if (node.commits.edges[0].node.commit.status) {
      state = node.commits.edges[0].node.commit.status.state;

      switch (node.commits.edges[0].node.commit.status.state) {
        case 'FAILURE':
          state = state;
        break;
        case 'SUCCESS':
          state = state;
        break;
      }
      state = node.commits.edges[0].node.commit.status.state;
    }

    results.push([
      node.repository.name,
      state,
      node.headRefName,
      node.baseRefName,
      'https://github.com' + node.resourcePath
    ]);
  });

  console.log(results.toString());
}
