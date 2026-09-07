import { expect, test } from "bun:test";
import { getSearchVolumeChange } from "./getSearchVolumeChange";

test("search volume trend measures keyword demand rather than domain traffic share", () => {
	expect(getSearchVolumeChange(1010, 1000)).toEqual({ absolute: 10, relative: 0.01 });
	expect(getSearchVolumeChange(500, 1000)).toEqual({ absolute: -500, relative: -0.5 });
	expect(getSearchVolumeChange(1000, 1000)).toEqual({ absolute: 0, relative: 0 });
	expect(getSearchVolumeChange(100, 0)).toEqual({ absolute: 100, relative: undefined });
	expect(getSearchVolumeChange(0, 0)).toEqual({ absolute: 0, relative: undefined });
});
