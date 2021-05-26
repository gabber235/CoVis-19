import { Observable } from "rxjs"
import { first } from "rxjs/operators"


export type DataSet<A> = { [id: number]: A }

/**
 * Represents a set of changes to a dataset
 */
export class DataSetDiff<A> {

    public readonly insertions: {id: number, value: A}[]
    public readonly updates: {id: number, value: A}[]
    public readonly deletions: {id: number}[]

    constructor(insertions: {id: number, value: A}[] = [], updates: {id: number, value: A}[] = [], deletions: {id: number}[] = []) {
        this.insertions = insertions
        this.updates = updates
        this.deletions = deletions
    }

    /**
     * Adds an insertion to the diff
     */
    add(id: number, value: A) {
        this.insertions.push({id: id, value: value})
    }
    /**
     * Adds an update to the diff
     */
    update(id: number, value: A) {
        this.updates.push({id: id, value: value})
    }
    /**
     * Adds a deletion to the diff
     */
    remove(id: number) {
        this.deletions.push({id: id})
    }

    /**
     * Changes every value and id using the given functions
     */
    map<B>(valueMap: (a: A) => B, idMap: (id: number) => number): DataSetDiff<B> {
        return new DataSetDiff(
            this.insertions.map(({id, value}) => {return {id: idMap(id), value: valueMap(value)}}),
            this.updates.map(({id, value}) => {return {id: idMap(id), value: valueMap(value)}}),
            this.deletions.map(({id}) => {return {id: idMap(id)}})
        )
    }

    /**
     * Creates a new DataSetDiff by concatenating the first and last diff in order
     */
    andThen(other: DataSetDiff<A>): DataSetDiff<A> {
        return new DataSetDiff(
            this.insertions.concat(other.insertions),
            this.updates.concat(other.updates),
            this.deletions.concat(other.deletions),
        )
    }

    /**
     * Applies the changes to a map
     */
    apply(dataSet: DataSet<A>) {
        for (const {id, value} of this.insertions) {
            dataSet[id] = value
        }
        for (const {id, value} of this.updates) {
            dataSet[id] = value
        }
        for (const {id} of this.deletions) {
            delete dataSet[id]
        }
    }

    get isEmpty(): boolean { 
        return this.insertions.length === 0 && this.updates.length === 0 && this.deletions.length === 0 
    }
}

/**
 * Represents changes to a set of numbers
 */
// NOTE: This is a lazy and dumb way to do this
export type NumberSetDiff = DataSetDiff<any>


/**
 * Computes the difference between two datasets which may include pointers
 */
export function diffDataSet<A>(prev: DataSet<A>, cur: DataSet<A>): DataSetDiff<A> {
    const diff = new DataSetDiff<A>()

    for (const id in cur) {
        if (id in prev) {
            diff.update(+id, cur[id])
        } else {
            diff.add(+id, cur[id])
        }
    }
    for (const id in prev) {
        if (!(id in cur)) diff.remove(+id)
    }

    return diff
}

/**
 * Computes the difference between two datasets that DON'T INCLUDE POINTERS
 */
 export function diffPureDataSet<A>(prev: DataSet<A>, cur: DataSet<A>): DataSetDiff<A> {
    const diff = new DataSetDiff<A>()

    for (const id in cur) {
        if (id in prev) {
            if (prev[id] !== cur[id])
                diff.update(+id, cur[id])
        } else {
            diff.add(+id, cur[id])
        }
    }
    for (const id in prev) {
        if (!(id in cur)) diff.remove(+id)
    }

    return diff
}




/**
 * Applies diff to acc
 * WARNING: MUTATES ACC
 */
export function foldDataSet<A>(acc: DataSet<A>, diff: DataSetDiff<A>): DataSet<A> {
    diff.apply(acc)
    return acc
}

// /**
//  * Ignore double insertions and deletions.
//  */
//  export function ignoreDoubles<A, X>(data: Observable<[DataSetDiff<A>, X]>): Observable<[DataSetDiff<A>, X]> {

//     const idSet = new Set<number>()

//     return new Observable(sub => {
//         data.subscribe({
//             next([diff, x]) {

//                 const newDiff = new DataSetDiff<A>()

//                 for (const change of diff.insertions) {
//                     if (!idSet.has(change.id)) {
//                         idSet.add(change.id)
//                         newDiff.add(change.id, change.value)
//                     }
//                 }
//                 for (const change of diff.updates) {
//                     if (idSet.has(change.id)) {
//                         newDiff.update(change.id, change.value)
//                     }
//                 }
//                 for (const change of diff.deletions) {
//                     if (idSet.has(change.id)) {
//                         newDiff.remove(change.id)
//                         idSet.delete(change.id)
//                     }
//                 }

//                 sub.next([newDiff, x])
//             }
//         })
//     })
// }

