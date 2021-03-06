import "vis/dist/vis.min.css"
import "prismjs/themes/prism.css"

import "../resources/static/logo.png"
import "../resources/static/dwayne-the-rock.jpg"

import { AdjacencyMatrix } from "./visualizations/adjacency-matrix/adjacency-matrix";
import { createLegend, NodeLinkVisualisation } from './visualizations/node-link/node-link';
import { Email, getCorrespondants, parseData, Person } from "./data"
import { combineLatest, fromEvent, merge, of, Subject, timer } from "rxjs";
import { debounce, map, scan, share, shareReplay, startWith } from "rxjs/operators";
import { DataSet, DataSetDiff, diffDataSet, foldDataSet, IDSetDiff } from "./pipeline/dynamicDataSet";
import { getDynamicCorrespondants } from "./pipeline/getDynamicCorrespondants";
import { binarySearch, ConstArray, millisInDay, pair, pairMap2, tripple } from "./utils";
import { prettifyFileInput, TimeSliders } from "./looks";
import { checkBoxObserable, diffStream, fileInputObservable, selectorObserable } from "./pipeline/basics";
import { dynamicSlice } from "./pipeline/dynamicSlice";
import { diffSwitchAll } from "./pipeline/diffSwitchAll";
import { NodeLinkOptions } from "./visualizations/node-link/options";
import { loadTimelineGraph, startTimeline } from "./visualizations/timeline";
import { groupEmailsToCount } from "./pipeline/timeline";
import { FilterOptions } from "./filter";

window.addEventListener("load", async () => {

    const fileSelector = document.getElementById('file-selector') as HTMLInputElement;

    const timeLine = await startTimeline()

    const timeSliders = new TimeSliders(
        timeLine,
        document.getElementById('first-day'),
        document.getElementById('last-day'),
        document.getElementById('duration'),
    )

    const filterOptions = new FilterOptions(
        document.getElementById('filter-options'),
    )
    prettifyFileInput(fileSelector)

    // This subject is used to represent selected correspondants and emails respectivly
    // They are represented by their id's
    const selectionSubject = new Subject<[IDSetDiff, IDSetDiff]>()

    const baseEmailObservable = fileInputObservable(fileSelector).pipe(
        map(parseData),
        map(emails => {
            emails.sort((i, j) => new Date(i.date).getTime() - new Date(j.date).getTime())
            return emails
        }),
        shareReplay(1),
    )

    const filteredEmails = filterOptions.filterEmails(baseEmailObservable)

    combineLatest([filteredEmails, fromEvent(window, 'resize').pipe(startWith(0))])
        .pipe(map(([emails]) => groupEmailsToCount(emails)))
        .subscribe(loadTimelineGraph)

    const dataWithAllNodes = filteredEmails.pipe(
        map(emails => {
            if (emails.length > 0) {

                const firstDate = new Date(emails[0].date).getTime()
                const lastDate = new Date(emails[emails.length - 1].date).getTime()

                const constEmails: ConstArray<[string, Email]> = { getItem: i => pair(`${emails[i].id}`, emails[i]), length: emails.length }
                const people = getCorrespondants(emails)

                function dayToIndex(day: number): number {
                    return binarySearch(i => new Date(emails[i].date).getTime(), firstDate + millisInDay * day, 0, emails.length, (i, j) => i - j)
                }
                const indices = timeSliders.timerange.pipe(
                    debounce(() => timer(60)),
                    map(([begin, end]) => pair(dayToIndex(begin), dayToIndex(end))),
                )

                timeSliders.setFirstAndLastDate(firstDate, lastDate)

                return dynamicSlice(constEmails, indices).pipe(
                    scan( // Get full email dataset and people
                        ([_, emails], emailDiff) => tripple(people, foldDataSet(emails, emailDiff), emailDiff),
                        tripple({} as DataSet<Person>, {} as DataSet<Email>, new DataSetDiff<Email>())
                    ),
                )
            } else {
                return of(tripple({} as DataSet<Person>, {} as DataSet<Email>, new DataSetDiff<Email>()))
            }
        }),
        diffSwitchAll( // merge the stream of streams
            () => ({} as DataSet<Email>),
            diffDataSet,
            ([_, emails]) => emails,
            ([_, __, emailDiff]) => emailDiff,
        ),
        map(([[people, emails], emailDiff]) => pair(pair(people, emails), pair(people, emailDiff))), // rearange data
        diffStream( // diff person dataset
            pair(pair({} as DataSet<Person>, {} as DataSet<Email>), pair({} as DataSet<Person>, new DataSetDiff())),
            pairMap2((_, x) => x, pairMap2(diffDataSet, (_, x) => x))
        ),
        share(),
    )

    const dataWithFewerNodes = dataWithAllNodes.pipe(
        map(([[_, emails], [__, emailDiff]]) => pair(emails, emailDiff)), // forget about people
        getDynamicCorrespondants(([_, diff]) => diff, ([emails, emailDiff], personDiff) => pair(emails, pair(personDiff, emailDiff))),
        scan( // get full people dataset
            ([[people]], [emails, [personDiff, emailDiff]]) =>
                pair(pair(foldDataSet(people, personDiff), emails), pair(personDiff, emailDiff)),
            pair(pair({} as DataSet<Person>, {} as DataSet<Email>), pair(new DataSetDiff<Person>(), new DataSetDiff<Email>()))
        ),
        share()
    )




    const nodeLinkOptions = merge(
        checkBoxObserable(document.getElementById('physics') as HTMLInputElement).pipe(
            map((b): NodeLinkOptions => ({ physics: b }))
        ),
        checkBoxObserable(document.getElementById('hierarchical') as HTMLInputElement).pipe(
            map((b): NodeLinkOptions => ({ hierarchical: b }))
        ),
        checkBoxObserable(document.getElementById('group-nodes') as HTMLInputElement).pipe(
            map((b): NodeLinkOptions => ({ groupNodes: b }))
        ),
        checkBoxObserable(document.getElementById('group-edges') as HTMLInputElement).pipe(
            map((b): NodeLinkOptions => ({ groupEdges: b }))
        ),
        selectorObserable(document.getElementById('solver') as HTMLSelectElement).pipe(
            map((v: any): NodeLinkOptions => ({ solver: v }))
        )
    )

    const allNodes = dataWithAllNodes.pipe(shareReplay(1))
    allNodes.subscribe()

    const fewerNodes = dataWithFewerNodes.pipe(shareReplay(1))
    fewerNodes.subscribe()


    const maybeShowAllNodes = checkBoxObserable(document.getElementById('show-all-nodes') as HTMLInputElement).pipe(
        map(bool => bool ? allNodes : fewerNodes),
        diffSwitchAll(
            () => pair({} as DataSet<Person>, {} as DataSet<Email>),
            pairMap2(diffDataSet, diffDataSet),
            ([data]) => data,
            ([_, diffs]) => diffs
        ),
        map(([_, [peopleDiff, emailDiff]]) => pair(peopleDiff, emailDiff)),
        share()
    )
    
    new AdjacencyMatrix().visualize(maybeShowAllNodes, selectionSubject).catch(e => console.error(e))
    
    
    createLegend(document.getElementById("node-link-legend"))

    const nodeLinkDiagram = new NodeLinkVisualisation(document.getElementById("node-links"), maybeShowAllNodes, selectionSubject, nodeLinkOptions, 150)
    nodeLinkDiagram.getVisSelections().subscribe(selectionSubject)
})