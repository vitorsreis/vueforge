<script setup>
import { ref } from 'vue'
import PageTitle from './PageTitle.vue'

const props = defineProps({ title: String, initialCount: Number })
const count = ref(props.initialCount)
</script>

<template>
  <PageTitle :title="`${title} ${count}`" />
  <button @click="count++">{{ title }} {{ count }}</button>
</template>

<style scoped>
button {
  color: rgb(20, 60, 100);
}
</style>
