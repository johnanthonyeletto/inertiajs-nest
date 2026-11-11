<script setup lang="ts">
import { Head } from '@inertiajs/vue3'

defineProps<{ message: string }>()
</script>

<template>
  <main>
    <Head title="Home" />
    <h1>{{ message }}</h1>
  </main>
</template>
