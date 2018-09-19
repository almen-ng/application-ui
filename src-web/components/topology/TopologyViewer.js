/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2018. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/
'use strict'

import React from 'react'
import PropTypes from 'prop-types'
import * as d3 from 'd3'
import resources from '../../../lib/shared/resources'
import config from '../../../lib/shared/config'
import DetailsView from './DetailsView'
import LayoutHelper from './layoutHelper'
import LinkHelper from './linkHelper'
import NodeHelper, {counterZoomLabels} from './nodeHelper'
import msgs from '../../../nls/platform.properties'
import _ from 'lodash'


resources(() => {
  require('../../../scss/topology-viewer.scss')
  require('../../../scss/topology-link.scss')
  require('../../../scss/topology-node.scss')
})

var currentZoom = {x:0, y:0, k:1}

class TopologyViewer extends React.Component {

  static propTypes = {
    activeFilters: PropTypes.object,
    context: PropTypes.object,
    getEditor: PropTypes.func,
    id: PropTypes.string,
    links: PropTypes.arrayOf(PropTypes.shape({
      source: PropTypes.any,
      target: PropTypes.any,
      label: PropTypes.string,
      type: PropTypes.string,
    })),
    nodes: PropTypes.arrayOf(PropTypes.shape({
      cluster: PropTypes.string,
      uid: PropTypes.string.isRequired,
      type: PropTypes.string,
      name: PropTypes.string,
    })),
    setViewer: PropTypes.func,
    staticResourceData: PropTypes.object,
    title: PropTypes.string,
  }

  constructor (props) {
    super(props)
    this.highlightMode = false
    this.state = {
      activeFilters: props.activeFilters,
      links: props.links,
      nodes: props.nodes,
      hiddenLinks: new Set(),
      selectedNodeId: ''
    }
    this.setContainerRef = elem => {
      this.containerRef = elem
    }
    if (props.setViewer) {
      props.setViewer(this)
    }
    this.resize = _.debounce(()=>{
      this.zoomFit()
    }, 150)
    const { locale } = this.props.context
    this.layoutHelper = new LayoutHelper(this.props.staticResourceData, locale)
    this.getLayoutNodes = this.getLayoutNodes.bind(this)
    this.lastLayoutBBox=undefined
  }

  componentDidMount() {
    window.addEventListener('resize', this.resize)
    this.generateDiagram()
  }

  componentDidUpdate(){
    this.generateDiagram()
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resize)
    this.destroyDiagram()
  }

  shouldComponentUpdate(nextProps, nextState){
    return this.state.selectedNodeId !== nextState.selectedNodeId
    || !_.isEqual(this.state.activeFilters, nextState.activeFilters)
    || !_.isEqual(this.state.nodes.map(n => n.id), nextState.nodes.map(n => n.id))
    || !_.isEqual(this.state.links.map(l => l.uid), nextState.links.map(l => l.uid))
    || !_.isEqual(this.state.hiddenLinks, nextState.hiddenLinks)
  }

  componentWillReceiveProps(){
    this.setState((prevState, props) => {
      // cache live update links and nodes until filter is changed
      let nodes = _.cloneDeep(props.nodes)
      const hiddenLinks = new Set()
      nodes = nodes.map(node => prevState.nodes.find(n => n.uid === node.uid) ||
          Object.assign(node, {layout: {newComer: {}}}))
      // to stabilize layout, just hide links in diagram that are gone
      prevState.links.forEach(a=>{
        if (props.links.findIndex(b=>{
          return a.uid===b.uid
        })==-1) {
          hiddenLinks.add(a.uid)
        }
      })

      // keep cache of everything
      const compare = (a,b) => {
        return a.uid===b.uid
      }
      const links = _.unionWith(prevState.links, props.links, compare)
      return {links, nodes, hiddenLinks, activeFilters: props.activeFilters}
    })

  }

  render() {
    const { title, context, staticResourceData, getEditor } = this.props
    const { selectedNodeId } = this.state
    const { locale } = context
    const svgId = this.getSvgId()
    return (
      <div className="topologyViewerDiagram" ref={this.setContainerRef} >
        {title && <div className='topologyViewerTitle'>
          {msgs.get('cluster.name', [title], locale)}
        </div>}
        <div className='topologyViewerContainer'>
          <svg id={svgId} className="topologyDiagram" />
          <input type='image' alt='zoom-in' className='zoom-in'
            onClick={this.handleZoomIn} src={`${config.contextPath}/graphics/zoom-in.svg`} />
          <input type='image' alt='zoom-out' className='zoom-out'
            onClick={this.handleZoomOut} src={`${config.contextPath}/graphics/zoom-out.svg`} />
          <input type='image' alt='zoom-target' className='zoom-target'
            onClick={this.handleTarget} src={`${config.contextPath}/graphics/zoom-center.svg`} />
        </div>
        { this.state.selectedNodeId && !getEditor &&
          <DetailsView
            context={this.context}
            onClose={this.handleDetailsClose}
            staticResourceData={staticResourceData}
            getLayoutNodes={this.getLayoutNodes}
            selectedNodeId={selectedNodeId}
          /> }
      </div>
    )
  }

  handleNodeClick = (node) => {
    d3.event.stopPropagation()

    // if there's a companion yaml editor, scroll to line
    const { getEditor } = this.props
    const editor = getEditor && getEditor()
    if (editor && node) {
      const line = node.$r||0
      editor.renderer.STEPS = 25
      editor.setAnimatedScroll(true)
      editor.scrollToLine(line, true, true, ()=>{})
      editor.selection.moveCursorToPosition({row: line, column: 0})
      editor.selection.selectLine()
    }
    this.setState({
      selectedNodeId: node?node.uid:undefined
    })
  }


  getLayoutNodes = () => {
    return this.layoutNodes
  }


  handleDetailsClose = () => {
    this.setState({
      selectedNodeId: ''
    })
  }

  destroyDiagram = () => {
    this.layoutHelper.destroy()
    const svg = d3.select('#'+this.getSvgId())
    if (svg) {
      svg.select('g.nodes').selectAll('*').remove()
      svg.select('g.links').selectAll('*').remove()
    }
  }

  generateDiagram() {
    if (!this.containerRef || this.highlightMode) {
      return
    }

    if (!this.svg) {
      this.svg = d3.select('#'+this.getSvgId())
      this.svg.append('g').attr('class', 'clusters')
      this.svg.append('g').attr('class', 'links')  // Links must be added before nodes, so nodes are painted on top.
      this.svg.append('g').attr('class', 'nodes')
      this.svg.on('click', this.handleNodeClick)
      this.svg.call(this.getSvgSpace())
    }

    // consolidate nodes/filter links/add layout data to each element
    const firstLayout = this.lastLayoutBBox===undefined
    const {nodes=[], links=[], hiddenLinks= new Set()} = this.state
    this.layoutHelper.layout(nodes, links, hiddenLinks, firstLayout, (layoutResults)=>{

      const {layoutNodes, layoutMap, layoutBBox} = layoutResults
      this.layoutBBox = layoutBBox

      // resize diagram to fit all the nodes
      if (firstLayout) {
        this.zoomFit()
      }

      // Create or refresh the nodes in the diagram.
      const transformation = d3.transition()
        .duration(firstLayout?400:800)
        .ease(d3.easeSinOut)
      this.svg.interrupt().selectAll('*').interrupt()

      // Create or refresh the links in the diagram.
      const linkHelper = new LinkHelper(this.svg, links, layoutNodes)
      linkHelper.removeOldLinksFromDiagram()
      linkHelper.addLinksToDiagram(currentZoom)
      linkHelper.moveLinks(transformation)

      const {topologyShapes} = this.props.staticResourceData
      const nodeHelper = new NodeHelper(this.svg, layoutNodes, topologyShapes, linkHelper, layoutMap, ()=>{
        this.highlightMode = false
      })
      nodeHelper.removeOldNodesFromDiagram()
      nodeHelper.addNodesToDiagram(currentZoom, this.handleNodeClick)
      nodeHelper.moveNodes(transformation)

      this.layoutNodes = layoutNodes
      this.lastLayoutBBox = layoutNodes.length ? this.layoutBBox : undefined
      counterZoomLabels(this.svg, currentZoom)
    })
  }

  getSvgSpace(duration=0){
    const svgSpace = d3.zoom()
      .scaleExtent([ 0.25, 4 ])
      .on('zoom', () => {
        currentZoom = d3.event.transform
        const svg = d3.select('#'+this.getSvgId())
        if (svg) {

          // zoom shapes and links
          const transition = d3.transition()
            .duration(duration)
            .ease(d3.easeSinOut)
          svg.select('g.nodes').selectAll('g.node')
            .transition(transition)
            .attr('transform', d3.event.transform)
          svg.select('g.links').selectAll('g.link')
            .transition(transition)
            .attr('transform', d3.event.transform)

          // counter-zoom first line of labels
          counterZoomLabels(svg, currentZoom)
        }
      })
    return svgSpace
  }

  handleZoomIn = () => {
    this.getSvgSpace(200).scaleBy(this.svg, 1.3)
  }

  handleZoomOut = () => {
    this.getSvgSpace(200).scaleBy(this.svg, 1 / 1.3)
  }

  handleTarget = () => {
    this.zoomFit()
  }

  zoomFit = () => {
    const {width, height} = this.layoutBBox
    if (width && height) {
      const svg = d3.select('#'+this.getSvgId())
      if (svg) {
        const root = svg.select('g.nodes')
        if (root && root.node()) {
          const parent = root.node().parentElement
          const {width: fullWidth, height: fullHeight} = parent.getBoundingClientRect()
          const scale = Math.min( 1, .99 / Math.max(width / fullWidth, height / fullHeight))
          this.getSvgSpace(200).translateTo(svg, width/2, height/2)
          this.getSvgSpace(200).scaleTo(svg, scale)
        }
      }
    }
    return 1
  }

  getSvgId() {
    const {id, title} = this.props
    return (title||'id')+id+''
  }
}

export default TopologyViewer
