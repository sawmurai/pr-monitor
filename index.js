const Table = require('cli-table');
const env = require('node-env-file');
const fetch = require('node-fetch');

try {
  env(__dirname + '/.env');
} catch(e) {
  console.error('.env file missing!');
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
                    state, 
                    contexts {
                      targetUrl,
                      state,
                      description,
                      context
                    }
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

const queryReviewRequests = `
  query {
    search(query: "type:pr state:open review-requested:${process.env.LOGIN}", type: ISSUE, first: 100) {
      issueCount
      pageInfo {
        endCursor
        startCursor
      }
      edges {
        node {
          ... on PullRequest {
            repository {
              nameWithOwner
            }
            number
            url
          }
        }
      }
    }
  }
`;

fetch('https://api.github.com/graphql', {
  method: 'POST',
  body: JSON.stringify({query}),
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
  },
}).then(res => res.text())
  .then(parseResult) 
  .catch(error => console.error(error));
 
fetch('https://api.github.com/graphql', {
  method: 'POST',
  body: JSON.stringify({"query": queryReviewRequests}),
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
  },
}).then(res => res.text())
  .then(parseReviewRequests)
  .catch(error => console.error(error));

function parseResult(body) {
  const data = JSON.parse(body);
  const results = new Table({
    head: ['Repository', 'CI', 'Review', 'Branch', 'Base', 'Link']
  });

  data.data.user.pullRequests.edges.forEach(edge => {
    const node = edge.node;

    if (node.state !== 'OPEN') {
      return;
    }

    let state = '';
    let link = 'https://github.com' + node.resourcePath;
    let failedJobs = [];
    let errorUrl = '';
    if (node.commits.edges[0].node.commit.status) {
      switch (node.commits.edges[0].node.commit.status.state) {
        case 'SUCCESS':
          state = 'OK';
        break;
        case 'FAILURE':
          state = 'ERR';

          node.commits.edges[0].node.commit.status.contexts.forEach(function(context) {
            if (context.state == 'ERROR') {
              errorUrl = context.targetUrl;
            } else if (context.state == 'FAILURE') {
              failedJobs.push(context.context);
            }
          });
        break;
        case 'PENDING':
          state = 'PEN';
        break;
      }
    }

    let approval = '';
    node.reviews.edges.forEach(edge => {
      switch (edge.node.state) {
        case 'APPROVED':
        case 'DISMISSED':
          approval = 'Approved';
        break;
        case 'CHANGES_REQUESTED':
          approval = 'Changes requested';
        break;
      }
    });

    if (errorUrl.length > 0) {
      link += '\n' + errorUrl;
    }

    if (failedJobs.length > 0) {
      link += '\n\nFailed:\n' + failedJobs.join('\n');
    }

    results.push([
      node.repository.name,
      state,
      approval,
      node.headRefName,
      node.baseRefName,
      link
    ]);
  });

  console.log(results.toString());
}

function parseReviewRequests(body) {
  const data = JSON.parse(body);

  const results = new Table({
    head: ['Repository', 'Link']
  });

  data.data.search.edges.forEach(edge => {
    const node = edge.node;
    
    results.push([
      node.repository.nameWithOwner,
      node.url
    ]);
  });

  if (results.length > 0) {
    console.log(results.toString());
  }
}
