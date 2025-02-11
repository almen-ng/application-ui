// Copyright (c) 2020 Red Hat, Inc. All Rights Reserved.
// Copyright Contributors to the Open Cluster Management project
'use strict'

import React from 'react'
import PropTypes from 'prop-types'
import resources from '../../../../lib/shared/resources'
import { AcmTextInput } from '@open-cluster-management/ui-components'
import {
  Checkbox,
  Accordion,
  AccordionItem,
  AccordionToggle,
  AccordionContent
} from '@patternfly/react-core'
import PlusCircleIcon from '@patternfly/react-icons/dist/js/icons/plus-circle-icon'
import TimesCircleIcon from '@patternfly/react-icons/dist/js/icons/times-circle-icon'
import { Tooltip, getSourcePath, removeVs } from 'temptifly'
import msgs from '../../../../nls/platform.properties'
import _ from 'lodash'

resources(() => {
  require('./style.scss')
})

export class ClusterSelector extends React.Component {
  static propTypes = {
    control: PropTypes.object,
    controlId: PropTypes.string,
    handleChange: PropTypes.func,
    locale: PropTypes.string
  };

  constructor(props) {
    super(props)
    this.state = { isExpanded: true }
    if (_.isEmpty(this.props.control.active)) {
      if (
        !this.props.control.showData ||
        this.props.control.showData.length === 0
      ) {
        this.props.control.active = {
          mode: true,
          clusterLabelsList: [
            { id: 0, labelName: '', labelValue: '', validValue: false }
          ],
          clusterLabelsListID: 1
        }
      } else {
        //display existing placement rule
        this.props.control.active = {
          mode: true,
          clusterLabelsList: this.props.control.showData,
          clusterLabelsListID: this.props.control.showData.length
        }
      }
    }
    this.props.control.validation = this.validation.bind(this)
  }

  render() {
    const { isExpanded } = this.state
    const onToggle = toggleStatus => {
      this.setState({ isExpanded: !toggleStatus })
    }
    const { controlId, locale, control } = this.props
    const { name, active, validation = {} } = control
    const modeSelected = active && active.mode === true
    const isExistingRule = _.get(this.props, 'control.showData', []).length > 0
    const isReadOnly = isExistingRule || !modeSelected
    const showLabels = modeSelected && isExpanded

    return (
      <React.Fragment>
        <div className="creation-view-controls-labels">
          <div>
            {name}
            {validation.required ? (
              <div className="creation-view-controls-required">*</div>
            ) : null}
            <Tooltip control={control} locale={locale} />
          </div>

          <div className="clusterSelector-container">
            <Checkbox
              className="clusterSelector-checkbox"
              isChecked={modeSelected}
              isDisabled={isExistingRule}
              id={`clusterSelector-checkbox-${controlId}`}
              label={msgs.get(
                'tooltip.creation.app.settings.clusterSelector',
                locale
              )}
              onChange={this.handleMode}
            />

            <Accordion>
              <AccordionItem>
                <AccordionToggle
                  onClick={() => {
                    onToggle(showLabels)
                  }}
                  isExpanded={showLabels}
                  id="labels-header"
                >
                  {msgs.get('edit.app.labelClusters.summary', locale)}
                </AccordionToggle>
                <AccordionContent isHidden={!showLabels}>
                  <div className="clusterSelector-labels-section">
                    <div className="labels-descr">
                      {msgs.get(
                        'creation.app.settings.selectorClusters.config',
                        locale
                      )}
                    </div>

                    <div
                      className="labels-section"
                      id={`clusterSelector-labels-section-${controlId}`}
                    >
                      {this.renderClusterLabels(control, isReadOnly, controlId)}
                      <div
                        className={`add-label-btn ${
                          isReadOnly ? 'btn-disabled' : ''
                        }`}
                        tabIndex="0"
                        role={'button'}
                        onClick={() =>
                          this.addLabelToList(control, !isReadOnly)
                        }
                        onKeyPress={this.addLabelKeyPress.bind(this)}
                      >
                        <PlusCircleIcon
                          color="#06c"
                          key="add-icon"
                          className="add-label-btn-icon"
                        />
                        <div className="add-label-btn-text">
                          {msgs.get(
                            'creation.app.settings.selectorClusters.prop.add',
                            locale
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </React.Fragment>
    )
  }

  validation(exceptions) {
    const { control, locale, controlId } = this.props
    if (_.get(control, 'active.mode', false)) {
      if (Object.keys(control.active.clusterLabelsList).length === 0) {
        //no cluster labels set
        exceptions.push({
          row: 1,
          text: msgs.get('creation.missing.clusterSelector.value', locale),
          type: 'error',
          controlId: `clusterSelector-labels-section-${controlId}`
        })
      }

      const labelNameSet = new Set()
      control.active.clusterLabelsList.map(item => {
        const { id, labelName, labelValue, validValue } = item
        const invalidLabel =
          (validValue || id === 0) && (!labelName || labelName.length === 0)
        const invalidValue =
          (validValue || id === 0) && (!labelValue || labelValue.length === 0)

        // Add exception if no input for labels or values
        if (invalidLabel) {
          exceptions.push({
            row: 1,
            text: msgs.get('creation.missing.clusterSelector.label', locale),
            type: 'error',
            controlId: `labelName-${id}`
          })
        }
        if (invalidValue) {
          exceptions.push({
            row: 1,
            text: msgs.get('creation.missing.clusterSelector.value', locale),
            type: 'error',
            controlId: `labelName-${id}`
          })
        }
        if (labelNameSet.has(labelName)) {
          exceptions.push({
            row: 1,
            text: msgs.get('creation.duplicate.clusterSelector.label', [labelName], locale),
            type: 'error',
            controlId: `labelName-${id}`
          })
        }
        labelNameSet.add(labelName)
      })


    }
  }

  renderClusterLabels = (control, isReadOnly, controlId) => {
    if (!_.get(control, 'active.clusterLabelsList')) {
      return ''
    }
    return (
      control.active &&
      control.active.clusterLabelsList.map(item => {
        const { id, labelName, labelValue, validValue } = item

        if (validValue || id === 0) {
          return (
            <React.Fragment key={id}>
              <div className="matching-labels-container">
                <div className="matching-labels-input">
                  <AcmTextInput
                    id={`labelName-${id}-${controlId}`}
                    className="text-input"
                    label={
                      id === 0
                        ? `${msgs.get('clusterSelector.label.field.ui')}`
                        : ''
                    }
                    value={labelName === '' ? '' : labelName}
                    placeholder={msgs.get(
                      'clusterSelector.label.placeholder.field'
                    )}
                    isDisabled={isReadOnly}
                    onChange={value =>
                      this.handleChange(value, 'labelName', id)
                    }
                    isRequired
                  />
                </div>
                <div className="matching-labels-input">
                  <AcmTextInput
                    id={`labelValue-${id}-${controlId}`}
                    className="text-input"
                    label={
                      id === 0
                        ? `${msgs.get('clusterSelector.value.field.ui')}`
                        : ''
                    }
                    value={labelValue === '' ? '' : labelValue}
                    placeholder={msgs.get(
                      'clusterSelector.value.placeholder.field'
                    )}
                    isDisabled={isReadOnly}
                    onChange={value =>
                      this.handleChange(value, 'labelValue', id)
                    }
                    isRequired
                  />
                </div>

                {id !== 0 ? ( // Option to remove added labels
                  <div
                    id={id}
                    className={`remove-label-btn ${
                      isReadOnly ? 'btn-disabled' : ''
                    }`}
                    tabIndex="0"
                    role={'button'}
                    onClick={() =>
                      this.removeLabelFromList(control, item, isReadOnly)
                    }
                    onKeyPress={this.removeLabelKeyPress.bind(this)}
                  >
                    <TimesCircleIcon color="#06c" key="remove-icon" />
                  </div>
                ) : (
                  ''
                )}
              </div>
            </React.Fragment>
          )
        }
        return ''
      })
    )
  };

  addLabelToList = (control, modeSelected) => {
    if (modeSelected) {
      // Create new "label" item
      control.active.clusterLabelsList.push({
        id: control.active.clusterLabelsListID,
        labelName: '',
        labelValue: '',
        validValue: true
      })
      control.active.clusterLabelsListID++

      // Update UI
      this.forceUpdate()
    }
  };

  addLabelKeyPress = e => {
    if (e.type === 'click' || e.key === 'Enter') {
      this.addLabelToList(this.props.control)
    }
  };

  removeLabelFromList = (control, item, isReadOnly) => {
    if (!isReadOnly) {
      // Removed labels are no longer valid
      control.active.clusterLabelsList[item.id].validValue = false

      // Update UI and yaml editor
      this.forceUpdate()
      this.handleChange({})
    }
  };

  removeLabelKeyPress = e => {
    if (e.type === 'click' || e.key === 'Enter') {
      this.removeLabelFromList(this.props.control, { id: e.target.id })
    }
  };

  handleMode = checked => {
    const { control, handleChange } = this.props
    const { active } = control
    if (active) {
      active.mode = checked
    }

    handleChange(control)
  };

  handleChange(value, targetName, targetID) {
    const { control, handleChange } = this.props

    if (targetName) {
      const { active } = control
      const { clusterLabelsList } = active
      if (clusterLabelsList && clusterLabelsList[targetID]) {
        if (targetName === 'labelName') {
          clusterLabelsList[targetID].labelName = value
        } else if (targetName === 'labelValue') {
          clusterLabelsList[targetID].labelValue = value
        }
        clusterLabelsList[targetID].validValue = true
      }
    }
    handleChange(control)
  }
}

export default ClusterSelector

export const summarize = (control, controlData, summary) => {
  const { clusterLabelsList } = control.active || {}
  if (
    clusterLabelsList &&
    _.get(control, 'type', '') !== 'hidden' &&
    _.get(control, 'active.mode')
  ) {
    clusterLabelsList.forEach(({ labelName, labelValue }) => {
      if (labelName && labelValue) {
        summary.push(`${labelName}=${labelValue}`)
      }
    })
  }
}

export const summary = control => {
  const { clusterLabelsList } = control.active || {}
  if (
    clusterLabelsList &&
    _.get(control, 'type', '') !== 'hidden' &&
    _.get(control, 'active.mode')
  ) {
    const labels = []
    clusterLabelsList.forEach(({ labelName, labelValue }) => {
      if (labelName && labelValue) {
        labels.push(`${labelName}=${labelValue}`)
      }
    })
    return [
      {
        term: 'Selector labels',
        desc: labels.join(', ')
      }
    ]
  }
}

export const reverse = (control, templateObject) => {
  if (!control.active) {
    let matchLabels
    const placement = _.get(templateObject, 'Placement')
    if (placement) {
      const sourcePath = 'Placement[0].spec.clusterSelector.matchLabels'
      matchLabels = _.get(templateObject, getSourcePath(sourcePath), {})
    } else {
      const local = _.get(
        templateObject,
        getSourcePath(
          'PlacementRule[0].spec.clusterSelector.matchLabels.local-cluster'
        )
      )
      if (!local) {
        matchLabels = _.get(
          templateObject,
          getSourcePath('PlacementRule[0].spec.clusterSelector.matchLabels')
        )
        if (!matchLabels) {
          matchLabels = _.get(
            templateObject,
            getSourcePath('PlacementRule[0].spec.clusterLabels.matchLabels')
          )
        }
      }
    }

    if (matchLabels) {
      matchLabels = removeVs(matchLabels)
      if (matchLabels) {
        const clusterLabelsList = Object.entries(matchLabels).map(
          ([labelName, labelValue], id) => {
            return {
              id,
              labelName,
              labelValue,
              validValue: true
            }
          }
        )
        control.active = {
          mode: true,
          clusterLabelsList,
          clusterLabelsListID: clusterLabelsList.length
        }
      }
    } else {
      const clusterLabelsList = [
        { id: 0, labelName: '', labelValue: '', validValue: false }
      ]
      control.active = {
        mode: false,
        clusterLabelsList,
        clusterLabelsListID: 1
      }
    }
  }
}
