import { Email, Person, Title, getCorrespondants } from "../../data";
import { Observable, Subject } from 'rxjs';
import { DataSetDiff, DataSet, IDSetDiff } from '../../pipeline/dynamicDataSet';
import { createAdjacencyMatrix } from "./createAdjacencyMatrix";
import { Edge, Node } from "./types";


export class AdjacencyMatrix {
    async visualize(data: Observable<[DataSetDiff<Person>, DataSetDiff<Email>]>, selSub: Subject<[IDSetDiff, IDSetDiff]>): Promise<void> {

        // datasets that hold the data
        const persons: DataSet<Person> = {};
        const emails: DataSet<Email> = {};

        // datasets that hold IDs of selected persons and emails
        const selectedPersons: DataSet<number> = {};
        const selectedEmails: DataSet<number> = {};

        // make updates work
        data.subscribe(([personDiff, emailsDiff]) => {
            // console.log(event)

            // implement the changes given by the diffs
            personDiff.apply(persons)
            emailsDiff.apply(emails);

            // get arrays from dataset objects
            const personList = Object.values(persons);
            const emailList = Object.values(emails);
            const selectedPersonIDs = Object.values(selectedPersons).map(i => +i);
            const selectedEmailIDs = Object.values(selectedEmails).map(i => +i);

            updateAM(personList, emailList, selectedPersonIDs, selectedEmailIDs);
        });

        // make selections works
        selSub.subscribe(([personDiff, emailsDiff]) => {
            // console.log(event)

            // implement the changes given by the diffs
            personDiff.apply(selectedPersons)
            emailsDiff.apply(selectedEmails);

            // get arrays from dataset objects
            const personList = Object.values(persons);
            const emailList = Object.values(emails);
            const selectedPersonIDs = Object.values(selectedPersons).map(i => +i);
            const selectedEmailIDs = Object.values(selectedEmails).map(i => +i);

            // console.log(persons, emails)
            updateAM(personList, emailList, selectedPersonIDs, selectedEmailIDs);
        })




        // takes persons, emails and selections and update the on-screen matrix accordingly
        function updateAM(persons: Person[], emailList: Email[], selPerIDs: number[], selEmIDs: number[]) {

            let nodes: Node[];

            nodes = peopleToNodes(persons);

            // get edges
            const links = emailsToEdges(emailList, nodes, selEmIDs);

            // call adjacency matrix  
            // createAdjacencyMatrix(filteredCorrespondants, emailsToEdges(emails), svg);
            createAdjacencyMatrix(selSub, emails, nodes, links, selectedPersons, selectedEmails);
        }
    }
}

// function to turn people objects into node usable by the matrix
function peopleToNodes(people: Person[]): Node[] {
    const nodes: Node[] = [];

    people.forEach((person) => {
        const newNode: Node = {
            name: emailToName(person.emailAdress),
            personId: person.id,
            jobTitle: person.title,
            totalSentiment: 0,
        };
        nodes.push(newNode);
    })

    return nodes;
}

// tries to turn email into name with proper capitalisation of letters
export function emailToName(email: string): string {
    let name: string = "";

    // remove everything behind @ and replace space with dot for next step
    const withoutAt = email.split('@')[0].replace(" ", ".")

    // split string at dots for each name part
    const parts: string[] = withoutAt.split(".");

    // capitalise first letter of each part
    for (let i = 0; i < parts.length; i++) {
        parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
    }

    // add parts back together, adding a dot if part is just one letter
    parts.forEach((part) => {
        if (part.length === 1) {
            name += part + ". ";
        } else {
            name += part + " ";
        }
    });

    // remove last space and return
    return name.slice(0, -1);
}

// takes emails and turns them into edges for the adjacency matrix, also account for selections
function emailsToEdges(emails: Email[], nodes: Node[], selEmIDs: number[]): Edge[] {
    const edges: Edge[] = [];

    // for each email check if it is already in the edge list
    // if so, increase it's value, else add it with value 1
    emails.forEach((email) => {
        // get source in nodelist
        const source = nodes.findIndex((node) => {
            return email.fromId === node.personId;
        });
        // get target in nodelist
        const target = nodes.findIndex((node) => {
            return email.toId === node.personId;
        });

        // NOTE: This is slow
        const indexInEdges = edges.findIndex((edge) => {
            return edge.sourceMatrixIndex === source && edge.targetMatrixIndex === target;
        })

        if (indexInEdges === -1) {
            // new edge

            // account for selected property
            let selected = false;
            if (selEmIDs.find((e) => { return e === email.id })) {
                selected = true;
            }

            const edge: Edge = {
                sourceMatrixIndex: source,
                targetMatrixIndex: target,
                emailCount: 1,
                sentiment: email.sentiment, // BUG: We don't update this sentiment later at all
                selected: selected,
            }
            edges.push(edge);
        } else {
            // edge already exists
            edges[indexInEdges].emailCount++;
            edges[indexInEdges].sentiment += email.sentiment;
        }

    })

    return edges;
}
