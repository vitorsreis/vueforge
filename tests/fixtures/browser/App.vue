<script setup>
import { inject, onMounted, ref } from 'vue'
import PageTitle from './PageTitle.vue'

const props = defineProps({ title: String, initialCount: Number })
const count = ref(props.initialCount)
const runtimeTarget = inject('vueforgeRuntimeTarget', '')
const runtimeTargetElement = ref()
onMounted(() => {
  runtimeTargetElement.value.textContent = runtimeTarget
})
</script>

<template>
  <main>
    <PageTitle :title="`${title} ${count}`" />
    <output ref="runtimeTargetElement" data-runtime-target></output>
    <button @click="count++">{{ title }} {{ count }}</button>
    <span
      v-if="count > initialCount && $attrs['data-request-note']"
      data-request-note
    >
      {{ $attrs['data-request-note'] }}
    </span>
  </main>
</template>

<style scoped>
button {
  color: rgb(20, 60, 100);
}
</style>
