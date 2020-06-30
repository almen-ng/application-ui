/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2017, 2019. All Rights Reserved.
 * Copyright (c) 2020 Red Hat, Inc.
 *
 * US Government Users Restricted Rights - Use, duplication or disclosure
 * restricted by GSA ADP Schedule Contract with IBM Corp.
 *******************************************************************************/
import R from 'ramda'

export const getSingleApplicationObject = list => {
  if (list && list.items instanceof Array && list.items.length > 0) {
    return list.items[0]
  }
  return ''
}

const getPlacementRuleObjs = (subData, allPlacementRules) => {
  Object.keys(subData).forEach(kindIndex => {
    if (subData[kindIndex].kind.toLowerCase() === 'placementrule') {
      const placementRules = subData[kindIndex].items
      Object.keys(placementRules).forEach(prIndex => {
        const prObj = {
          name: placementRules[prIndex].name,
          namespace: placementRules[prIndex].namespace
        }
        allPlacementRules = allPlacementRules.concat(prObj)
      })
    }
  })
  return allPlacementRules
}

export const getNumPlacementRules = (
  subscriptions,
  isSingleApplicationView,
  applicationName,
  applicationNamespace
) => {
  if (subscriptions && subscriptions.items) {
    let allPlacementRules = []

    // Single application view
    if (isSingleApplicationView) {
      Object.keys(subscriptions.items).forEach(subIndex => {
        // Get number of placement rules for the current application opened
        if (
          subscriptions.items[subIndex].namespace === applicationNamespace &&
          subscriptions.items[subIndex].related
        ) {
          // Placement rule data found in "related" object
          const subData = subscriptions.items[subIndex].related

          // Check that the data's app name matches with the selected app name
          const isCurrentApp = subData.find(data => {
            return data.items[0].name === applicationName
          })

          if (isCurrentApp) {
            allPlacementRules = getPlacementRuleObjs(
              subData,
              allPlacementRules
            )
          }
        }
      })
    } else {
      // Root application view
      // Get number of placement rules for all applications
      Object.keys(subscriptions.items).forEach(subIndex => {
        // Placement rule data found in "related" object
        if (subscriptions.items[subIndex].related) {
          allPlacementRules = getPlacementRuleObjs(
            subscriptions.items[subIndex].related,
            allPlacementRules
          )
        }
      })
    }

    // Remove duplicate placement rules (that were found in more than one app)
    allPlacementRules = R.uniq(allPlacementRules)

    return allPlacementRules.length
  }
  // -1 is used to identify when skeleton text load bar should appear
  return -1
}

const getSubObjs = (subData, allSubscriptions, allChannels) => {
  Object.keys(subData).forEach(subIndex => {
    const subObj = {
      status: subData[subIndex].status,
      id: subData[subIndex]._uid
    }
    allSubscriptions = allSubscriptions.concat(subObj)
    allChannels = allChannels.concat(subData[subIndex].channel)
  })
  return [allSubscriptions, allChannels]
}

export const getSubscriptionDataOnHub = (
  applications,
  isSingleApplicationView,
  applicationName,
  applicationNamespace
) => {
  if (applications && applications.items) {
    let allSubscriptions = []
    let failedSubsCount = 0
    let noStatusSubsCount = 0
    let allChannels = []

    // Single application view
    if (isSingleApplicationView) {
      Object.keys(applications.items).forEach(appIndex => {
        // Get subscription data for the current application opened
        if (
          applications.items[appIndex].name === applicationName &&
          applications.items[appIndex].namespace === applicationNamespace &&
          applications.items[appIndex].hubSubscriptions
        ) {
          const subObjs = getSubObjs(
            applications.items[appIndex].hubSubscriptions,
            allSubscriptions,
            allChannels
          )
          allSubscriptions = subObjs[0]
          allChannels = subObjs[1]
        }
      })
    } else {
      // Root application view
      // Get subscription data for all applications
      Object.keys(applications.items).forEach(appIndex => {
        if (applications.items[appIndex].hubSubscriptions) {
          const subObjs = getSubObjs(
            applications.items[appIndex].hubSubscriptions,
            allSubscriptions,
            allChannels
          )
          allSubscriptions = subObjs[0]
          allChannels = subObjs[1]
        }
      })
    }

    if (allChannels.length > 0) {
      // Remove duplicate channels (that were found in more than one app)
      allChannels = R.uniq(allChannels)
    }

    if (allSubscriptions.length > 0) {
      // Remove duplicate subscriptions (that were found in more than one app)
      allSubscriptions = R.uniq(allSubscriptions)

      // Increment "no status" and "failed" counts using the new non-duplicated subscriptions list
      Object.keys(allSubscriptions).forEach(key => {
        if (
          allSubscriptions[key].status === null ||
          allSubscriptions[key].status === undefined ||
          allSubscriptions[key].status === ''
        ) {
          noStatusSubsCount++
        } else if (
          allSubscriptions[key].status.toLowerCase() !== 'propagated'
        ) {
          failedSubsCount++
        }
      })
    }

    return {
      total: allSubscriptions.length,
      failed: failedSubsCount,
      noStatus: noStatusSubsCount,
      channels: allChannels.length
    }
  }
  // data is undefined... -1 is used to identify when skeleton text load bar should appear
  return {
    total: -1,
    channels: -1
  }
}

const getRemoteSubsCounts = (
  subData,
  allSubscriptions,
  failedSubsCount,
  noStatusSubsCount
) => {
  Object.keys(subData).forEach(key => {
    if (key === 'Failed') {
      failedSubsCount = subData[key]
    } else if (key === 'Subscribed') {
      allSubscriptions = subData[key]
    } else {
      // All statuses that are neither "Failed" or "Subscribed" belong to "No status"
      noStatusSubsCount += subData[key]
    }
  })
  allSubscriptions += failedSubsCount + noStatusSubsCount

  return [allSubscriptions, failedSubsCount, noStatusSubsCount]
}

export const getSubscriptionDataOnManagedClustersSingle = (
  applications,
  applicationName,
  applicationNamespace
) => {
  if (applications && applications.items) {
    let managedClusterCount = 0
    let allSubscriptions = 0
    let failedSubsCount = 0
    let noStatusSubsCount = 0

    Object.keys(applications.items).forEach(appIndex => {
      // Get subscription data for the current application opened
      if (
        applications.items[appIndex].name === applicationName &&
        applications.items[appIndex].namespace === applicationNamespace
      ) {
        if (applications.items[appIndex].clusterCount !== undefined) {
          managedClusterCount = applications.items[appIndex].clusterCount
        }
        // Increment counts if the data exists
        if (applications.items[appIndex].remoteSubscriptionStatusCount) {
          const countData = getRemoteSubsCounts(
            applications.items[appIndex].remoteSubscriptionStatusCount,
            allSubscriptions,
            failedSubsCount,
            noStatusSubsCount
          )
          allSubscriptions = countData[0]
          failedSubsCount = countData[1]
          noStatusSubsCount = countData[2]
        }
      }
    })

    return {
      clusters: managedClusterCount,
      total: allSubscriptions,
      failed: failedSubsCount,
      noStatus: noStatusSubsCount
    }
  }
  // data is undefined... -1 is used to identify when skeleton text load bar should appear
  return {
    clusters: -1
  }
}

export const getSubscriptionDataOnManagedClustersRoot = applications => {
  if (applications && applications.items) {
    let managedClusterCount = 0
    let allSubscriptions = 0
    let failedSubsCount = 0
    let noStatusSubsCount = 0

    if (applications.items.clusterCount !== undefined) {
      managedClusterCount = applications.items.clusterCount
    }
    // Increment counts if the data exists
    if (applications.items.remoteSubscriptionStatusCount) {
      const countData = getRemoteSubsCounts(
        applications.items.remoteSubscriptionStatusCount,
        allSubscriptions,
        failedSubsCount,
        noStatusSubsCount
      )
      allSubscriptions = countData[0]
      failedSubsCount = countData[1]
      noStatusSubsCount = countData[2]
    }

    return {
      clusters: managedClusterCount,
      total: allSubscriptions,
      failed: failedSubsCount,
      noStatus: noStatusSubsCount
    }
  }
  // data is undefined... -1 is used to identify when skeleton text load bar should appear
  return {
    clusters: -1
  }
}

export const getPodData = (
  applications,
  applicationName,
  applicationNamespace
) => {
  if (applications && applications.items) {
    let allPods = 0
    let runningPods = 0
    let failedPods = 0
    let inProgressPods = 0

    Object.keys(applications.items).forEach(appIndex => {
      // Get pod data for the current application opened
      if (
        applications.items[appIndex].name === applicationName &&
        applications.items[appIndex].namespace === applicationNamespace &&
        applications.items[appIndex].podStatusCount
      ) {
        // Increment counts if the data exists
        const podData = applications.items[appIndex].podStatusCount
        const podStatuses = Object.keys(podData)
        podStatuses.forEach(status => {
          if (
            status.toLowerCase() === 'running' ||
            status.toLowerCase() === 'pass' ||
            status.toLowerCase() === 'deployed'
          ) {
            runningPods += podData[status]
          } else if (
            status.toLowerCase() === 'pending' ||
            status.toLowerCase().includes('progress')
          ) {
            inProgressPods += podData[status]
          } else if (
            status.toLowerCase().includes('fail') ||
            status.toLowerCase().includes('error') ||
            status.toLowerCase().includes('backoff')
          ) {
            failedPods += podData[status]
          } else {
            allPods += podData[status]
          }
        })
        allPods += runningPods + failedPods + inProgressPods
      }
    })

    return {
      total: allPods,
      running: runningPods,
      failed: failedPods,
      inProgress: inProgressPods
    }
  }
  // data is undefined... -1 is used to identify when skeleton text load bar should appear
  return {
    total: -1
  }
}

export const concatDataForTextKey = (
  mainCounter,
  valueToShow,
  textOption1,
  textOption2
) => {
  return mainCounter === -1
    ? -1
    : valueToShow
      .toString()
      .concat(' ', valueToShow === 1 ? textOption1 : textOption2)
}

export const concatDataForSubTextKey = (
  mainCounter,
  valueToCheck,
  valueToShow,
  text
) => {
  return mainCounter === -1
    ? -1
    : valueToCheck > 0 ? valueToShow.toString().concat(' ', text) : ''
}
