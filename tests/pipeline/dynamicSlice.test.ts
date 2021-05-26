import { Observable, of, Subject } from "rxjs"
import { map, share } from "rxjs/operators"
import { foldDiffFirst, observableToArray } from "../../src/pipeline/basics"
import { DataSet, DataSetDiff } from "../../src/pipeline/dynamicDataSet"
import { dynamicSlice } from "../../src/pipeline/dynamicSlice"


describe("pipeline.dynamicSlice.dynamicSlice", () => {
    test("0", () => {
        const array = {getItem: (index: number): [number, number] => [index,index], length: 5}
        const range: Observable<[number, number]> = of([0, 5])

        const sliced = dynamicSlice(array, range).pipe(
            map((x): [DataSetDiff<number>, null] => [x, null]),
            foldDiffFirst,
            map(([a, b]): [DataSet<number>, null] => [Object.assign({}, a), b])
        )
        
        expect(observableToArray(sliced))
        .toEqual([
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
            }, null]
        ])
    })
    test("1", () => {
        const array = {getItem: (index: number): [number, number] => [index,index], length: 100}
        const range: Observable<[number, number]> = of([0, 5])

        const sliced = dynamicSlice(array, range).pipe(
            map((x): [DataSetDiff<number>, null] => [x, null]),
            foldDiffFirst,
            map(([a, b]): [DataSet<number>, null] => [Object.assign({}, a), b])
        )

        expect(observableToArray(sliced))
        .toEqual([
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
            }, null]
        ])
    })
    test("2", () => {
        const array = {getItem: (index: number): [number, number] => [index,index], length: 100}
        const range: Observable<[number, number]> = of([0, 5], [0, 10]) as any

        const sliced = dynamicSlice(array, range).pipe(
            map((x): [DataSetDiff<number>, null] => [x, null]),
            foldDiffFirst,
            map(([a, b]) => [Object.assign({}, a), b])
        )

        expect(observableToArray(sliced))
        .toEqual([
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
            }, null],
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
                5: 5,
                6: 6,
                7: 7,
                8: 8,
                9: 9,
            }, null],
        ])
    })
    test("3", () => {
        const array = {getItem: (index: number): [number, number] => [index,index], length: 100}
        const range = new Subject<[number, number]>()


        const sliced = dynamicSlice(array, range).pipe(
            map((x): [DataSetDiff<number>, null] => [x, null]),
            foldDiffFirst,
            map(([a, b]): [DataSet<number>, null] => [Object.assign({}, a), b])
        )

        const arr = observableToArray(sliced)

        range.next([0, 5])
        range.next([0, 10])
        range.next([5, 10])

        expect(arr)
        .toEqual([
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
            }, null],
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
                5: 5,
                6: 6,
                7: 7,
                8: 8,
                9: 9,
            }, null],
            [{
                5: 5,
                6: 6,
                7: 7,
                8: 8,
                9: 9,
            }, null],
        ])
    })
    test("4", () => {
        const array = {getItem: (index: number): [number, number] => [index,index], length: 100}
        const range = new Subject<[number, number]>()


        const sliced = dynamicSlice(array, range).pipe(
            map((x): [DataSetDiff<number>, null] => [x, null]),
            foldDiffFirst,
            map(([a, b]): [DataSet<number>, null] => [Object.assign({}, a), b])
        )

        const arr = observableToArray(sliced)

        range.next([0, 5])
        range.next([0, 10])
        range.next([5, 10])
        range.next([-10, 10])
        range.next([-10, 3])


        expect(arr)
        .toEqual([
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
            }, null],
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
                5: 5,
                6: 6,
                7: 7,
                8: 8,
                9: 9,
            }, null],
            [{
                5: 5,
                6: 6,
                7: 7,
                8: 8,
                9: 9,
            }, null],
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
                5: 5,
                6: 6,
                7: 7,
                8: 8,
                9: 9,
            }, null],
            [{
                0: 0,
                1: 1,
                2: 2,
            }, null],
        ])
    })
    test("5", () => {
        const array = {getItem: (index: number): [number, number] => [index,index], length: 100}
        const range = new Subject<[number, number]>()


        
        const sliced = dynamicSlice(array, range).pipe(
            map((x): [DataSetDiff<number>, null] => [x, null]),
            foldDiffFirst,
            map(([a, b]): [DataSet<number>, null] => [Object.assign({}, a), b])
        )

        const arr = observableToArray(sliced)

        range.next([0, 5])
        range.next([10, 15])

        expect(arr)
        .toEqual([
            [{
                0: 0,
                1: 1,
                2: 2,
                3: 3,
                4: 4,
            }, null],
            [{
                10: 10,
                11: 11,
                12: 12,
                13: 13,
                14: 14,
            }, null],
        ])
    })
})