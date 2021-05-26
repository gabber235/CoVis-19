import "vis/dist/vis.min.css"
import { AdjacencyMatrix } from "./visualizations/adjacency-matrix";
import { visualizeNodeLinkDiagram, NodeLinkOptions, getVisNodeSeletions } from "./visualizations/node-link";
import { Email, getCorrespondants, parseData, Person } from "./data"
import { combineLatest, identity, merge, Subject } from "rxjs";
import { debounceTime, map, scan, share, switchAll } from "rxjs/operators";
import { DataSet, DataSetDiff, diffDataSet, foldDataSet, NumberSetDiff } from "./pipeline/dynamicDataSet";
import { getDynamicCorrespondants } from "./pipeline/getDynamicCorrespondants";
import { ConstArray, pair, pairMap2, swap, tripple } from "./utils";
import { prettifyFileInput } from "./looks";
import { checkBoxObserable, diffStream, fileInputObservable, sliderToObservable } from "./pipeline/basics";
import { dynamicSlice } from "./pipeline/dynamicSlice";
import { diffSwitchAll } from "./pipeline/diffSwitchAll";

const logo = require('../resources/static/logo.png')

window.addEventListener("load", async () => {

    console.log('Image:', logo.default)

    const fileSelector = document.getElementById('file-selector');


    const range = combineLatest([
        sliderToObservable(document.getElementById('range1')),
        sliderToObservable(document.getElementById('range2'))
    ]).pipe(
        map(([i, j]): [number, number] => [i, i + j]),
        debounceTime(10)
    )


    prettifyFileInput(fileSelector)

    // This subject is used to represent selected correspondants and emails respectivly
    // They are represented by their id's
    const selectionSubject = new Subject<[NumberSetDiff, NumberSetDiff]>()

    selectionSubject.subscribe(console.log)

    const baseEmailObservable = fileInputObservable(fileSelector).pipe(map(parseData))

    const changes = baseEmailObservable.pipe(
        map(emails => {
            const constEmails: ConstArray<[number, Email]> = {getItem: i => [emails[i].id, emails[i]], length: emails.length}
            const people = getCorrespondants(emails)

            return dynamicSlice(constEmails, range).pipe(
                scan( // Get full email dataset and people
                    ([_, emails, __], emailDiff) => tripple(people, foldDataSet(emails, emailDiff), emailDiff),
                    tripple({} as DataSet<Person>, {} as DataSet<Email>, new DataSetDiff<Email>())
                )
            )
        }),
        diffSwitchAll( // merge the stream of streams
            {} as DataSet<Email>,
            diffDataSet,
            ([_, emails, __]) => emails,
            ([_, __, emailDiff]) => emailDiff,
        ),
        map(([[people, _, __], emailDiff]) => pair(people, emailDiff)), // forget unneeded data
        diffStream(pair({} as DataSet<Person>, new DataSetDiff()), pairMap2(diffDataSet, (_, x) => x)), // diff person dataset
        share(),
    )

    const changesWithFewerNodes = changes.pipe(
        map(([_, emails]) => emails), // forget about people
        getDynamicCorrespondants(identity),
        map(([people, emails]): [DataSetDiff<Person>, DataSetDiff<Email>] => [people, emails])
    )


    new AdjacencyMatrix().visualize(changes)


    const nodeLinkOptions = merge(
        checkBoxObserable(document.getElementById('physics')).pipe(
            map((b): NodeLinkOptions => {return {physics: b}})   
        ),
        checkBoxObserable(document.getElementById('hierarchical')).pipe(
            map((b): NodeLinkOptions => {return {hierarchical: b}})   
        )
    )

    const nodeLinkDiagram = await visualizeNodeLinkDiagram(document.getElementById("node-links"), changesWithFewerNodes, nodeLinkOptions, 150)
    getVisNodeSeletions(nodeLinkDiagram).subscribe(selectionSubject)
})




// type DataSetDiff<A> = {type:'add', id: number, content: A[]}|{type:'remove', id: number, content: A[]}

// type FinalDataSetDiff = DataSetDiff<[EmailData, VisualData]>

// type DynamicDataSet<A> = Observable<DataSetDiff<A>>

// map : (A -> B) -> DynamicDataSet<A> -> DynamicDataSet<B>

// base.filter(range).filter(title).orderBy(cluster).map().interaction(selected)


// filter :  Observable<[A -> bool, DataSetDiff<A>]> ->  DynamicDataSet<A>

// filter : Observable<[]>


// filter :  Observable<[A -> bool, A[]]> ->  Observable<A[]>
