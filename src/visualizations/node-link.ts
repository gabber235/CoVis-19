import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as vis from 'vis';
import { Email, Correspondants, Person, Title } from '../data';
import { DataSet, DataSetDiff } from '../pipeline/dynamicDataSet';

export type NodeLinkOptions = {
    hierarchical?: boolean,
    physics?: boolean
}

const nodeSize = 10

/**
 * Create a new vis.Network instance and bind it to 'container'
 */
export async function visualizeNodeLinkDiagram(container: HTMLElement, data: Observable<[DataSetDiff<Person>, DataSetDiff<Email>]>, options: Observable<NodeLinkOptions>, maxNodes: number): Promise<void> {

    const people: DataSet<Person> = {}
    const emails: DataSet<Email> = {}

    let nodeCount = 0

    const circleLayoutRadius = maxNodes * (nodeSize * 2 + 2) / Math.PI / 2

    const nodes = new vis.DataSet()
    const edges = new vis.DataSet<vis.Edge>()

    const prevOptions = defaultNodeLinkOptions

    let visualisation = new vis.Network(container, { nodes: nodes, edges: edges }, {})


    options.subscribe({next (options) {

        const fullReset = 'hierarchical' in options && prevOptions.hierarchical !== options.hierarchical

        if (fullReset) {
            nodes.clear()
            edges.clear()
        }

        visualisation.setOptions(nodeLinkOptionsToVisOptions(Object.assign(prevOptions, options)))

        if (fullReset) {
            nodes.add(Object.values(people).map(person => Object.assign({}, personToNode(person), nodeLocation(person))))
            edges.add(Object.values(emails).map(emailToEdge))
        }
    }})
    data.subscribe({next ([personDiff, emailDiff]) {

        // console.log(emailDiff)

        nodes.add(personDiff.insertions.map(({value}) => Object.assign({}, personToNode(value), nodeLocation(value))))
        edges.add(emailDiff.insertions.map(({value}) => emailToEdge(value)))

        nodes.update(personDiff.updates.map(({value}) => personToNode(value)))
        edges.update(emailDiff.updates.map(({value}) => emailToEdge(value)))

        edges.remove(emailDiff.deletions.map(({id}) => id))
        nodes.remove(personDiff.deletions.map(({id}) => id))

        personDiff.apply(people)
        emailDiff.apply(emails)

        nodeCount += personDiff.insertions.length
        nodeCount -= personDiff.deletions.length
    }})

    function nodeLocation(person: Person): {x:number,y:number} {
        return {
            x: circleLayoutRadius * Math.cos(2 * Math.PI * person.id / maxNodes),
            y: circleLayoutRadius * Math.sin(2 * Math.PI * person.id / maxNodes),
        }
    }
}


const defaultNodeLinkOptions: NodeLinkOptions = {
    physics: true,
    hierarchical: false
}

export function nodeLinkOptionsToVisOptions(config: NodeLinkOptions): vis.Options {

    const options = Object.assign({}, defaultNodeLinkOptions, config)

    return {
        nodes: {
            shape: 'dot',
            size: nodeSize,
        },
        edges: {
            arrows: "to"
        },
        layout: {
            hierarchical: {
                enabled: options.hierarchical,
                nodeSpacing: 20,
                treeSpacing: 20,
            },
        },
        physics: {
            enabled: options.physics,
            barnesHut: {
                centralGravity: 1
            }
        }
    }
}

function personToNode(p: Person): vis.Node {
    return {
        id: p.id,
        title: `${p.emailAdress}, ${p.title}`,
        group: p.title,
        level: titleRanks[p.title],
    }
}
function emailToEdge(e: Email): vis.Edge {
    return {
        id: e.id,
        from: e.fromId,
        to: e.toId,
        title: "" + e.sentiment
    }
}


const titleRanks = {
    "CEO": 0,
    "President": 1,
    "Vice President": 2,
    "Managing Director": 3,
    "Director": 4,
    "Manager": 5,
    "Trader": 6,
    "Employee": 7,
    "In House Lawyer": 8,
    "Unknown": 9,
}