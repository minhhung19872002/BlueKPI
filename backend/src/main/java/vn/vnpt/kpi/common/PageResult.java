package vn.vnpt.kpi.common;

import java.util.List;
import java.util.function.Function;

/** data = { items, total, page, size } */
public record PageResult<T>(List<T> items, long total, int page, int size) {

    public static <T> PageResult<T> of(List<T> items, long total, PageQuery q) {
        return new PageResult<>(items, total, q.getPage(), q.getSize());
    }

    public <R> PageResult<R> map(Function<T, R> fn) {
        return new PageResult<>(items.stream().map(fn).toList(), total, page, size);
    }
}
