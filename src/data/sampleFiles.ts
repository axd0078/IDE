import { FileNode } from '../store/types';

export const sampleFiles: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    children: [
      {
        id: 'src/main.c',
        name: 'main.c',
        type: 'file',
        language: 'c',
        content: `#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");
    return 0;
}
`,
      },
      {
        id: 'src/utils.c',
        name: 'utils.c',
        type: 'file',
        language: 'c',
        content: `#include <math.h>

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

double power(double base, int exp) {
    double result = 1.0;
    for (int i = 0; i < exp; i++) {
        result *= base;
    }
    return result;
}
`,
      },
      {
        id: 'src/utils.h',
        name: 'utils.h',
        type: 'file',
        language: 'c',
        content: `#ifndef UTILS_H
#define UTILS_H

int factorial(int n);
double power(double base, int exp);

#endif
`,
      },
    ],
  },
  {
    id: 'examples',
    name: 'examples',
    type: 'folder',
    children: [
      {
        id: 'examples/sort.c',
        name: 'sort.c',
        type: 'file',
        language: 'c',
        content: `#include <stdio.h>

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main(void) {
    int arr[] = {64, 34, 25, 12, 22, 11, 90};
    int n = sizeof(arr) / sizeof(arr[0]);

    bubbleSort(arr, n);

    printf("Sorted array: ");
    for (int i = 0; i < n; i++) {
        printf("%d ", arr[i]);
    }
    printf("\\n");
    return 0;
}
`,
      },
    ],
  },
];
