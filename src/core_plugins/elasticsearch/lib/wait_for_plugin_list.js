import _ from 'lodash';

module.exports = function (plugin, server) {
  const config = server.config();
  // here we use admin cluster to make sure the _cat/plugins
  // will work even if it is a tribe cluster
  const callWithInternalUser = server.plugins.elasticsearch.getCluster('admin').callWithInternalUser;

  return Promise.all(
    [
      callWithInternalUser('cat.nodes', { h: 'name,node.role,ip', format:'json' }),
      callWithInternalUser('cat.plugins', { h: 'name,component,version', format: 'json' })
    ]
  ).then(([ nodeList, pluginList ]) => {
    const elasticsearchPluginNames = [];
    const elasticsearchPlugins = [];

    if (nodeList && pluginList) {
      // each element of nodeList contains:
      // name - node name
      // node.role - type of node: d for data nodes
      // ip - node ip address
      // each element of pluginList contains:
      // name - node name
      // component - plugin name

      let detectedSirenJoin = false;

      // 1 first gather list of all plugins
      _.each(pluginList, function (pluginEntry) {
        if (elasticsearchPluginNames.indexOf(pluginEntry.component) === -1) {
          elasticsearchPluginNames.push(pluginEntry.component);
          elasticsearchPlugins.push(pluginEntry);
        }
        if (pluginEntry.component === 'siren-federate' || pluginEntry.component === 'siren-vanguard') {
          detectedSirenJoin = true;
        }
      });

      config.set('investigate_core.clusterplugins', elasticsearchPluginNames);

      // 2 if siren-federate detected, verify that it is installed on all data nodes
      if (detectedSirenJoin) {
        _.each(nodeList, function (nodeEntry) {
          const nodeName = nodeEntry.name;
          const nodeRole = nodeEntry['node.role'];
          const nodeIp = nodeEntry.ip;
          // we only check that siren-federate is installed on data nodes
          if (nodeRole === 'd') {
            let foundCorrespondingNode = false;
            _.each(pluginList, function (pluginEntry) {
              const nName = pluginEntry.name;
              const pName = pluginEntry.component;
              if ((pName === 'siren-vanguard' || pName === 'siren-federate') && nName === nodeName) {
                foundCorrespondingNode = true;
                return false;
              }
            });
            if (!foundCorrespondingNode) {
              plugin.status.red(
                'Siren Federate plugin is missing at data node:[' + nodeName + '] ip:[' + nodeIp + ']\n' +
                'Siren Federate plugin should be installed on all data nodes.'
              );
            }
          }
        });
      }
    }

    return elasticsearchPlugins;
  })
  .catch(err => {
    config.set('investigate_core.clusterplugins', []);
    plugin.status.yellow(err);
  });
};
