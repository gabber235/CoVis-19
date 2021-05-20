import "vis/dist/vis.min.css"
import { AdjacencyMatrix } from "./visualizations/adjacency-matrix";
import { visualizeNodeLinkDiagram, NodeLinkOptions } from "./visualizations/node-link";
import { Email, getCorrespondants, parseData, Person } from "./data"
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { DataSet, DataSetDiff, diffDataSet } from "./pipeline/dynamicDataSet";
import { diffMapFirst, swap } from "./utils";


window.addEventListener("load", async () => {

    const baseEmailObservable = new Observable<[DataSet<Person>, Email[]]>(sub => {
        const fileSelector = document.getElementById('file-selector');
        fileSelector.addEventListener('change', async (event: any) => {
            const fileList: FileList = event.target.files;

            for (let i = 0; i < fileList.length; i++) {
                const txt = await fileList.item(i).text()
                const emails = parseData(txt)
                const correspondants = getCorrespondants(emails)
                sub.next([correspondants, emails])
            }
        });
    })


    const nodeLinkOptions = new Observable<NodeLinkOptions>(sub => {
        const physicsCheckBox: any = document.getElementById("physics")
        sub.next({physics: physicsCheckBox.checked})

        physicsCheckBox.addEventListener("change", (e: any) => {
            sub.next({physics: e.target.checked})
        })

        const layoutCheckBox: any = document.getElementById("hierarchical")
        sub.next({hierarchical: layoutCheckBox.checked})

        layoutCheckBox.addEventListener("change", (e: any) => {
            sub.next({hierarchical: e.target.checked})
        })
    })
    

    const changes = baseEmailObservable.pipe(
        map(([correspondants, emails]): [DataSet<Person>, Email[]] => [correspondants, emails.slice(0, 100)]),
        map(([correspondants, emails]): [DataSet<Person>, DataSet<Email>] => [correspondants, Object.assign({}, ...emails.map(email => { return { [email.id]: email } }))]),
        diffMapFirst({} as DataSet<Person>, diffDataSet),
        map(swap),
        diffMapFirst({} as DataSet<Email>, diffDataSet),
        map(swap),
        
    )

    new AdjacencyMatrix().visualize(changes)
    visualizeNodeLinkDiagram(document.getElementById("node-links"), changes, nodeLinkOptions)
})



// type DataSetDiff<A> = {type:'add', id: number, content: A[]}|{type:'remove', id: number, content: A[]}

// type FinalDataSetDiff = DataSetDiff<[EmailData, VisualData]>

// type DynamicDataSet<A> = Observable<DataSetDiff<A>>

// map : (A -> B) -> DynamicDataSet<A> -> DynamicDataSet<B>

// base.filter(range).filter(title).orderBy(cluster).map().interaction(selected)


// filter :  Observable<[A -> bool, DataSetDiff<A>]> ->  DynamicDataSet<A>

// filter : Observable<[]>


// filter :  Observable<[A -> bool, A[]]> ->  Observable<A[]>
